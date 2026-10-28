import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export { THREE };

export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const webglAvailable = () => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
};

// Creates a renderer, scene and camera inside `el`, keeps them sized to the
// element, runs the animation loop and returns a disposer.
export function createStage(el, { fov = 45, background = null, controls = true, alpha = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.borderRadius = 'inherit';

  const scene = new THREE.Scene();
  if (background) scene.background = new THREE.Color(background);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 5000);
  const orbit = controls ? new OrbitControls(camera, renderer.domElement) : null;
  if (orbit) { orbit.enableDamping = true; orbit.dampingFactor = 0.08; }

  const resize = () => {
    const w = el.clientWidth || 300, h = el.clientHeight || 200;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  const tickers = [];
  let raf = 0;
  const clock = new THREE.Clock();
  const loop = () => {
    const dt = clock.getDelta(), t = clock.elapsedTime;
    for (const fn of tickers) fn(dt, t);
    orbit?.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const dispose = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    orbit?.dispose();
    scene.traverse((o) => {
      o.geometry?.dispose();
      const m = o.material;
      (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose(); x.dispose(); });
    });
    renderer.dispose();
    renderer.domElement.remove();
  };
  return { renderer, scene, camera, orbit, onTick: (fn) => tickers.push(fn), dispose };
}

// Text label as a camera-facing sprite.
export function labelSprite(text, { color = '#0f172a', bg = 'rgba(255,255,255,0.94)', border = '#b8922a', size = 1, bold = true } = {}) {
  const pad = 22, fs = 46;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${bold ? 700 : 500} ${fs}px Inter, system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2, h = fs + pad * 1.4;
  c.width = w; c.height = h;
  ctx.font = `${bold ? 700 : 500} ${fs}px Inter, system-ui, sans-serif`;
  const r = h / 2;
  ctx.fillStyle = bg; ctx.strokeStyle = border; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.roundRect(3, 3, w - 6, h - 6, r); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.renderOrder = 10;
  const scale = size * 0.012;
  sprite.scale.set(w * scale, h * scale, 1);
  return sprite;
}

// Convert [[lat, lng]] to local metres (x east, z south) around an origin.
export function toLocal(points, origin) {
  const [lat0, lng0] = origin;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), kz = 110540;
  return points.map(([lat, lng]) => new THREE.Vector2((lng - lng0) * kx, -(lat - lat0) * kz));
}

export const centroid = (pts) => {
  const ys = pts.map((p) => p[0]), xs = pts.map((p) => p[1]);
  return [(Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...xs) + Math.max(...xs)) / 2];
};

// Smooth pseudo-noise for terrain.
export const noise = (x, z) => Math.sin(x * 0.045) * Math.cos(z * 0.038) * 1.6 + Math.sin(x * 0.11 + z * 0.07) * 0.6 + Math.cos(z * 0.13 - x * 0.05) * 0.4;

// A polygon as an extruded slab (Shape lives in XY; rotate onto the ground).
export function slab(local, { depth = 0.8, color = '#7fb069', top, opacity = 1, emissive = 0x000000 } = {}) {
  const shape = new THREE.Shape(local.map((v) => new THREE.Vector2(v.x, -v.y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.25, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2);
  const mats = [
    new THREE.MeshStandardMaterial({ color: top || color, roughness: 0.85, transparent: opacity < 1, opacity, emissive }),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: opacity < 1, opacity, emissive }),
  ];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

export function outline(local, y, color = '#e3c877', width = 0.35) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4 });
  for (let i = 0; i < local.length; i++) {
    const a = local[i], b = local[(i + 1) % local.length];
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, width, width), mat);
    m.position.set((a.x + b.x) / 2, y, (a.y + b.y) / 2);
    m.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
    group.add(m);
  }
  return group;
}

export function post(height = 3, color = '#1f3864') {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, height, 12), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6 }));
  pole.position.y = height / 2; pole.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
  cap.position.y = height; cap.castShadow = true;
  g.add(pole, cap);
  return g;
}

export function tree(scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 2 * scale, 8), new THREE.MeshStandardMaterial({ color: '#6b4f2a', roughness: 1 }));
  trunk.position.y = scale; trunk.castShadow = true;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 * scale, 0), new THREE.MeshStandardMaterial({ color: '#3f8f4f', roughness: 0.9, flatShading: true }));
  crown.position.y = 2.6 * scale; crown.castShadow = true;
  g.add(trunk, crown);
  return g;
}
