import { useEffect, useRef, useState } from 'react';
import { THREE, createStage, labelSprite, prefersReducedMotion, webglAvailable } from './core.js';
import { useTheme } from '../theme.jsx';

// The seal ledger as a 3D chain of blocks. Blocks turn green or red after a
// full ledger check. Clicking a block opens it.
export default function Chain3D({ blocks = [], status, onSelect, height = 260 }) {
  const host = useRef(null);
  const [ok] = useState(webglAvailable);
  const { theme } = useTheme();
  const key = JSON.stringify([blocks.map((b) => b.position), status ? [...status.values()].map((s) => s.ok) : null]);
  const sel = useRef(onSelect);
  sel.current = onSelect;

  useEffect(() => {
    if (!ok || !host.current || !blocks.length) return;
    const dark = theme === 'dark';
    const stage = createStage(host.current, { fov: 40 });
    const { scene, camera, orbit, renderer, onTick } = stage;
    renderer.setClearColor(0x000000, 0);
    scene.add(new THREE.HemisphereLight('#ffffff', dark ? '#1b2440' : '#c7d2fe', dark ? 0.9 : 1.2));
    const key = new THREE.DirectionalLight('#fff7e6', 2.2); key.position.set(8, 14, 10); scene.add(key);
    const back = new THREE.DirectionalLight('#93c5fd', 0.8); back.position.set(-10, 4, -8); scene.add(back);

    const list = [...blocks].reverse(); // oldest on the left
    const gap = 4.2;
    const meshes = [];
    const group = new THREE.Group();
    scene.add(group);
    list.forEach((b, i) => {
      const st = status?.get(b.position);
      const color = st ? (st.ok ? '#15803d' : '#b91c1c') : '#1f3864';
      const x = (i - (list.length - 1) / 2) * gap;
      const y = Math.sin(i * 0.7) * 0.35;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.35 }));
      mesh.position.set(x, y, 0);
      mesh.rotation.set(0.35, 0.6, 0);
      mesh.userData = { position: b.position, baseY: y, phase: i * 0.6 };
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: st && !st.ok ? '#fecaca' : '#e3c877' }));
      mesh.add(edges);
      group.add(mesh); meshes.push(mesh);
      const lab = labelSprite(`#${b.position}`, { size: 2.1, border: st ? (st.ok ? '#16a34a' : '#dc2626') : '#b8922a' });
      lab.position.set(x, y + 2.9, 0); group.add(lab);
      const code = labelSprite(b.code, { size: 1.35, bold: false, color: '#334155', border: '#cbd5e1' });
      code.position.set(x, y - 2.8, 0); group.add(code);
      if (i < list.length - 1) {
        // chain link to the next block
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 10, 24), new THREE.MeshStandardMaterial({ color: '#e3c877', metalness: 0.8, roughness: 0.25 }));
        link.position.set(x + gap / 2, (y + Math.sin((i + 1) * 0.7) * 0.35) / 2, 0);
        link.rotation.y = Math.PI / 2;
        group.add(link);
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, gap - 2.4, 8), new THREE.MeshStandardMaterial({ color: '#b8922a', metalness: 0.7, roughness: 0.3 }));
        bar.rotation.z = Math.PI / 2; bar.position.copy(link.position); group.add(bar);
      }
    });

    const span = list.length * gap;
    camera.position.set(0, 2.5, Math.max(14, span * 0.5));
    orbit.target.set(0, 0, 0);
    orbit.enableZoom = true; orbit.minDistance = 6; orbit.maxDistance = span * 1.4;
    orbit.autoRotate = false;

    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hover = null;
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      return ray.intersectObjects(meshes, false)[0]?.object || null;
    };
    const move = (e) => { hover = pick(e); renderer.domElement.style.cursor = hover ? 'pointer' : 'grab'; };
    let down = null;
    const pd = (e) => { down = [e.clientX, e.clientY]; };
    const pu = (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) { const m = pick(e); if (m) sel.current?.(m.userData.position); }
      down = null;
    };
    const el = renderer.domElement;
    el.addEventListener('pointermove', move); el.addEventListener('pointerdown', pd); el.addEventListener('pointerup', pu);
    const still = prefersReducedMotion();
    onTick((dt, t) => {
      for (const m of meshes) {
        const target = m === hover ? 1.18 : 1;
        m.scale.setScalar(m.scale.x + (target - m.scale.x) * 0.15);
        if (!still) { m.rotation.y += dt * 0.35; m.position.y = m.userData.baseY + Math.sin(t * 1.2 + m.userData.phase) * 0.18; }
      }
    });
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerdown', pd); el.removeEventListener('pointerup', pu); stage.dispose(); };
  }, [key, ok, theme]);

  if (!ok) return null;
  return <div ref={host} className="three-host" style={{ height }} role="img" aria-label="3D view of the seal ledger as a chain of blocks" />;
}
