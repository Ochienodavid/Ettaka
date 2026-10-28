import { useEffect, useRef, useState } from 'react';
import { Compass, Eye, Pause, Play, RotateCcw } from 'lucide-react';
import { THREE, centroid, createStage, labelSprite, noise, outline, post, prefersReducedMotion, slab, toLocal, tree, webglAvailable } from './core.js';
import { useTheme } from '../theme.jsx';

const fmt = (n) => Math.round(n).toLocaleString();

// Interactive 3D model of a plot: terrain, the plot slab, numbered boundary
// posts, measured edge lengths, neighbouring plots and conflicts.
export default function Plot3D({ boundary = [], others = [], height = 400, title }) {
  const host = useRef(null);
  const api = useRef({});
  const { theme } = useTheme();
  const [spin, setSpin] = useState(!prefersReducedMotion());
  const [ok] = useState(webglAvailable);
  // Rebuild the scene only when the geometry really changes.
  const geomKey = JSON.stringify([boundary, others.map((o) => [o.id, o.conflict, o.boundary])]);
  const spinRef = useRef(spin);
  spinRef.current = spin;

  useEffect(() => {
    if (!ok || !host.current || boundary.length < 3) return;
    const dark = theme === 'dark';
    const stage = createStage(host.current, { background: dark ? '#0d1628' : '#d8e6f7' });
    const { scene, camera, orbit } = stage;
    const origin = centroid(boundary);
    const local = toLocal(boundary, origin);
    const R = Math.max(12, ...local.map((v) => v.length()));
    scene.fog = new THREE.Fog(dark ? '#0d1628' : '#d8e6f7', R * 5, R * 11);

    // Lights
    scene.add(new THREE.HemisphereLight(dark ? '#9fb4e0' : '#e8f1ff', dark ? '#1d2b18' : '#557a3a', dark ? 0.7 : 1.0));
    const sun = new THREE.DirectionalLight('#fff4dc', dark ? 1.4 : 2.2);
    sun.position.set(R * 1.4, R * 2.2, R * 0.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -R * 3, right: R * 3, top: R * 3, bottom: -R * 3, near: 1, far: R * 8 });
    scene.add(sun);

    // Terrain: gentle hills, flattened under the plot
    const size = R * 9;
    const g = new THREE.PlaneGeometry(size, size, 120, 120);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = [];
    const c1 = new THREE.Color(dark ? '#2f4a2a' : '#7fb069'), c2 = new THREE.Color(dark ? '#3e5c33' : '#a7cf7d'), c3 = new THREE.Color(dark ? '#4a4030' : '#c9b98a');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.sqrt(x * x + z * z) / (R * 1.5);
      const k = Math.min(1, Math.max(0, (d - 1) / 1.2));
      const y = noise(x * (40 / R), z * (40 / R)) * (R / 14) * k * k - 0.05;
      pos.setY(i, y);
      const t = (noise(x * 0.3, z * 0.3) + 2) / 4;
      const col = c1.clone().lerp(c2, t);
      if (k > 0.6 && t > 0.7) col.lerp(c3, 0.25);
      colors.push(col.r, col.g, col.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    ground.receiveShadow = true;
    scene.add(ground);

    // Scenery trees well outside the plot
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.sin(i * 7.3) * 0.3;
      const r = R * (1.8 + ((i * 37) % 10) / 6);
      const t = tree(R / 22 * (0.8 + ((i * 13) % 5) / 8));
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const k = Math.min(1, Math.max(0, (r / (R * 1.5) - 1) / 1.2));
      t.position.set(x, noise(x * (40 / R), z * (40 / R)) * (R / 14) * k * k, z);
      scene.add(t);
    }

    // Neighbouring plots
    for (const o of others) {
      if (!o.boundary || o.boundary.length < 3) continue;
      const l = toLocal(o.boundary, origin);
      if (Math.max(...l.map((v) => v.length())) > R * 4.2) continue;
      const m = slab(l, { depth: o.conflict ? 1.1 : 0.35, color: o.conflict ? '#ef4444' : '#94a3b8', opacity: o.conflict ? 0.55 : 0.5 });
      m.position.y = o.conflict ? 0.25 : 0.02;
      scene.add(m);
      scene.add(outline(l, o.conflict ? 1.5 : 0.5, o.conflict ? '#dc2626' : '#64748b', 0.22));
      const c = l.reduce((s, v) => s.add(v), new THREE.Vector2()).divideScalar(l.length);
      const lab = labelSprite(o.conflict ? `⚠ ${o.code} overlap` : o.code, { color: o.conflict ? '#fff' : '#334155', bg: o.conflict ? 'rgba(220,38,38,0.95)' : 'rgba(255,255,255,0.85)', border: o.conflict ? '#991b1b' : '#94a3b8', size: R / 15 });
      lab.position.set(c.x, (o.conflict ? 5 : 3) * (R / 30) + 1.5, c.y);
      scene.add(lab);
    }

    // The plot
    const plot = slab(local, { depth: 0.7, color: '#6b8e4e', top: '#9fd27a' });
    scene.add(plot);
    scene.add(outline(local, 1.0, '#e3c877', Math.max(0.3, R / 60)));
    const ph = Math.max(2.6, R / 9);
    local.forEach((v, i) => {
      const p = post(ph);
      p.position.set(v.x, 0.6, v.y);
      scene.add(p);
      const lab = labelSprite(String(i + 1), { color: '#fff', bg: 'rgba(31,56,100,0.96)', border: '#e3c877', size: R / 13 });
      lab.position.set(v.x, ph + R / 9, v.y);
      scene.add(lab);
      const w = local[(i + 1) % local.length];
      const len = v.distanceTo(w);
      const m = labelSprite(`${len.toFixed(1)} m`, { color: '#1f3864', bg: 'rgba(255,255,255,0.92)', border: '#cbd5e1', size: R / 17, bold: false });
      m.position.set((v.x + w.x) / 2, 1.6 + R / 30, (v.y + w.y) / 2);
      scene.add(m);
    });
    // area label
    let area = 0;
    for (let i = 0; i < local.length; i++) { const a = local[i], b = local[(i + 1) % local.length]; area += a.x * b.y - b.x * a.y; }
    area = Math.abs(area / 2);
    const al = labelSprite(`${(area / 4046.86).toFixed(2)} acres · ${fmt(area)} m²`, { size: R / 9 });
    al.position.set(0, ph + R * 0.5, 0);
    scene.add(al);

    // North arrow
    const north = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(R / 18, R / 6, 4), new THREE.MeshStandardMaterial({ color: '#dc2626' }));
    cone.rotation.x = -Math.PI / 2; north.add(cone);
    const nl = labelSprite('N', { color: '#dc2626', size: R / 14 });
    nl.position.set(0, R / 10, -R / 8); north.add(nl);
    north.position.set(-R * 1.25, 0.8, -R * 1.25);
    scene.add(north);

    // Camera
    const home = () => { camera.position.set(R * 1.1, R * 1.0, R * 1.45); orbit.target.set(0, R * 0.05, 0); };
    home();
    orbit.maxPolarAngle = Math.PI / 2.15;
    orbit.minDistance = R * 0.5;
    orbit.maxDistance = R * 6;
    orbit.autoRotate = spinRef.current;
    orbit.autoRotateSpeed = 0.7;
    api.current = {
      reset: home,
      top: () => { camera.position.set(0.01, R * 3, 0.01); orbit.target.set(0, 0, 0); },
      spin: (v) => { orbit.autoRotate = v; },
    };
    return () => stage.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomKey, theme, ok]);

  useEffect(() => { api.current.spin?.(spin); }, [spin]);

  if (!ok) return <div className="map map-error" style={{ height }}>3D view needs WebGL, which this browser does not support.</div>;
  if (boundary.length < 3) return <div className="map" style={{ height, display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>Map the boundary to see the 3D model.</div>;
  return (
    <div className="three-wrap" style={{ height }}>
      <div ref={host} className="three-host" aria-label={title ? `3D model of ${title}` : '3D model of the plot'} role="img" />
      <div className="three-tools">
        <button className="btn btn-xs btn-outline" onClick={() => setSpin(!spin)}>{spin ? <Pause size={12} /> : <Play size={12} />} {spin ? 'Pause' : 'Rotate'}</button>
        <button className="btn btn-xs btn-outline" onClick={() => api.current.top?.()}><Eye size={12} /> Top</button>
        <button className="btn btn-xs btn-outline" onClick={() => api.current.reset?.()}><RotateCcw size={12} /> Reset</button>
      </div>
      <div className="three-hint"><Compass size={12} /> Drag to orbit · scroll to zoom · right-drag to pan</div>
    </div>
  );
}
