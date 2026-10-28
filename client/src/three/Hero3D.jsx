import { useEffect, useRef, useState } from 'react';
import { THREE, createStage, labelSprite, noise, outline, post, prefersReducedMotion, slab, tree, webglAvailable } from './core.js';

// Landing-page diorama: a floating island of mapped plots with the Ettaka seal
// hovering above. Pointer movement tilts the scene.
export default function Hero3D({ height = 520, stats }) {
  const host = useRef(null);
  const [ok] = useState(webglAvailable);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  useEffect(() => {
    if (!ok || !host.current) return;
    const stage = createStage(host.current, { controls: false, fov: 38 });
    const { scene, camera, renderer, onTick } = stage;
    renderer.setClearColor(0x000000, 0);
    const still = prefersReducedMotion();

    scene.add(new THREE.HemisphereLight('#eef4ff', '#5d7f3d', 1.15));
    const sun = new THREE.DirectionalLight('#fff3d6', 2.4);
    sun.position.set(30, 50, 25); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
    scene.add(sun);
    const rim = new THREE.DirectionalLight('#9db8ff', 0.8);
    rim.position.set(-30, 20, -30); scene.add(rim);

    const world = new THREE.Group();
    scene.add(world);

    // Island: soil cylinder with a low-poly grass top
    const R = 26;
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.82, 7, 48, 1), new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 1, flatShading: true }));
    soil.position.y = -3.6; soil.castShadow = true; soil.receiveShadow = true;
    world.add(soil);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(R * 0.82, 9, 24), new THREE.MeshStandardMaterial({ color: '#6e4527', roughness: 1, flatShading: true }));
    rock.rotation.x = Math.PI; rock.position.y = -11.6; world.add(rock);
    const top = new THREE.CircleGeometry(R, 64, 0, Math.PI * 2);
    top.rotateX(-Math.PI / 2);
    const p = top.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), d = Math.sqrt(x * x + z * z) / R;
      p.setY(i, Math.max(0, noise(x * 1.6, z * 1.6) * 0.55 * Math.max(0, d - 0.55) * 3));
    }
    top.computeVertexNormals();
    const grass = new THREE.Mesh(top, new THREE.MeshStandardMaterial({ color: '#8cc46a', roughness: 1, flatShading: true }));
    grass.receiveShadow = true;
    world.add(grass);

    // Plots in an irregular grid
    const plots = [
      [[-15, -9], [-5, -11], [-4, -2], [-14, 0]],
      [[-4, -11.5], [6, -10], [5, -2.5], [-3, -2]],
      [[6.5, -9.5], [15, -6], [12, 2], [5.5, -2]],
      [[-14, 1], [-4, -1], [-3, 9], [-12, 10]],
      [[-2.5, -1.5], [5, -1.8], [11.5, 2.8], [8, 11], [-2, 9.5]],
    ];
    const sealedIdx = 4;
    const seal = new THREE.Group();
    plots.forEach((pts, i) => {
      const l = pts.map(([x, z]) => new THREE.Vector2(x, z));
      const sealed = i === sealedIdx;
      const s = slab(l, { depth: sealed ? 0.55 : 0.3, color: '#6f9450', top: sealed ? '#b5dd8c' : ['#9fd27a', '#a8d47f', '#94c86f', '#9ccc77'][i % 4] });
      s.position.y = 0.05; world.add(s);
      world.add(outline(l, sealed ? 0.85 : 0.55, sealed ? '#e3c877' : '#d6c08a', sealed ? 0.32 : 0.18));
      l.forEach((v) => { const pp = post(sealed ? 2.2 : 1.4, sealed ? '#1f3864' : '#64748b'); pp.scale.setScalar(0.75); pp.position.set(v.x, 0.3, v.y); world.add(pp); });
    });
    // houses and trees
    const house = (x, z, rot, color = '#f8fafc', roof = '#c2410c') => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
      b.position.y = 1.2; b.castShadow = true; g.add(b);
      const r = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.4, 4), new THREE.MeshStandardMaterial({ color: roof, roughness: 0.7, flatShading: true }));
      r.position.y = 2.8; r.rotation.y = Math.PI / 4; r.castShadow = true; g.add(r);
      g.position.set(x, 0, z); g.rotation.y = rot; world.add(g);
    };
    house(-9, -5, 0.3); house(2.5, 4.2, -0.2, '#fff7ed', '#9a3412'); house(-8, 5, 0.8, '#f1f5f9', '#b45309');
    [[-18, 6], [-17, -3], [16, 6], [9, -13], [-10, -15], [18, -2], [3, 15], [-6, 15], [13, 12], [0, -6], [10, -4]].forEach(([x, z], i) => {
      const t = tree(0.55 + (i % 3) * 0.12); t.position.set(x, 0, z); world.add(t);
    });

    // Floating seal emblem above the sealed plot
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 3.4); shieldShape.lineTo(2.8, 2.5); shieldShape.lineTo(2.8, 0.3);
    shieldShape.quadraticCurveTo(2.6, -2.6, 0, -3.6); shieldShape.quadraticCurveTo(-2.6, -2.6, -2.8, 0.3);
    shieldShape.lineTo(-2.8, 2.5); shieldShape.lineTo(0, 3.4);
    const shield = new THREE.Mesh(new THREE.ExtrudeGeometry(shieldShape, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.22, bevelSegments: 4 }),
      new THREE.MeshStandardMaterial({ color: '#2251b8', metalness: 0.35, roughness: 0.3 }));
    shield.geometry.center(); shield.castShadow = true;
    seal.add(shield);
    const gold = new THREE.MeshStandardMaterial({ color: '#e3c877', metalness: 0.75, roughness: 0.25, emissive: '#b8922a', emissiveIntensity: 0.25 });
    const tick = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.5), gold); a.position.set(-0.75, -0.35, 0); a.rotation.z = -Math.PI / 4;
    const b = new THREE.Mesh(new THREE.BoxGeometry(3, 0.55, 0.5), gold); b.position.set(0.7, 0.35, 0); b.rotation.z = Math.PI / 4;
    tick.add(a, b); tick.position.z = 0.65; seal.add(tick);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.18, 16, 96), gold); seal.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.07, 8, 96), gold); ring2.rotation.x = Math.PI / 2.4; seal.add(ring2);
    seal.position.set(4, 11, 4);
    world.add(seal);
    // light beam from seal to plot
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 2.6, 10, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#e3c877', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(4, 5.6, 4); world.add(beam);

    // floating data chips
    const chip3 = labelSprite('SHA-256 · hash-chained', { size: 1.7, color: '#1f3864', border: '#2251b8' });
    chip3.position.set(4, 19.5, 4); world.add(chip3);

    // particles
    const N = 140;
    const pg = new THREE.BufferGeometry();
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { arr[i * 3] = (Math.sin(i * 12.9) * 0.5) * 70; arr[i * 3 + 1] = 2 + ((i * 7) % 30); arr[i * 3 + 2] = Math.cos(i * 7.7) * 35; }
    pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const dots = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#e3c877', size: 0.35, transparent: true, opacity: 0.7, depthWrite: false }));
    world.add(dots);

    camera.position.set(0, 34, 62);
    camera.lookAt(0, 2, 0);
    world.rotation.y = -0.45;

    const target = { x: 0, y: 0 };
    const onMove = (e) => {
      const r = host.current?.getBoundingClientRect(); if (!r) return;
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 0.2;
    };
    window.addEventListener('pointermove', onMove);
    onTick((dt, t) => {
      if (!still) {
        world.rotation.y += ((-0.45 + target.x + Math.sin(t * 0.15) * 0.25) - world.rotation.y) * 0.04;
        world.rotation.x += ((target.y * 0.6) - world.rotation.x) * 0.04;
        world.position.y = Math.sin(t * 0.8) * 0.6;
        seal.position.y = 11 + Math.sin(t * 1.4) * 0.7;
        seal.rotation.y = t * 0.8;
        ring2.rotation.z = t * 0.6;
        dots.rotation.y = t * 0.03;
        beam.material.opacity = 0.12 + Math.sin(t * 2) * 0.05;
      }
    });
    return () => { window.removeEventListener('pointermove', onMove); stage.dispose(); };
  }, [ok, stats?.sealed]);

  if (!ok) return null;
  return <div ref={host} className="three-host" style={{ height, width: '100%' }} role="img" aria-label="3D illustration: mapped plots on an island, protected by the Ettaka seal" />;
}
