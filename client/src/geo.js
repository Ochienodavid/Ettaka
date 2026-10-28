// Client-side copy of the server's overlap check, used to warn while drawing.
const R = 6378137;
const rad = (d) => (d * Math.PI) / 180;
export function areaM2(points) {
  if (!points || points.length < 3) return 0;
  let t = 0;
  for (let i = 0; i < points.length; i++) {
    const [a1, o1] = points[i], [a2, o2] = points[(i + 1) % points.length];
    t += rad(o2 - o1) * (2 + Math.sin(rad(a1)) + Math.sin(rad(a2)));
  }
  return Math.abs((t * R * R) / 2);
}
const bbox = (p) => p.reduce((b, [y, x]) => [Math.min(b[0], y), Math.min(b[1], x), Math.max(b[2], y), Math.max(b[3], x)], [Infinity, Infinity, -Infinity, -Infinity]);
function inside([y, x], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function overlapPct(a, b, n = 40) {
  if (!a || !b || a.length < 3 || b.length < 3) return 0;
  const A = bbox(a), B = bbox(b);
  const y0 = Math.max(A[0], B[0]), x0 = Math.max(A[1], B[1]), y1 = Math.min(A[2], B[2]), x1 = Math.min(A[3], B[3]);
  if (y0 >= y1 || x0 >= x1) return 0;
  let hits = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p = [y0 + ((i + 0.5) / n) * (y1 - y0), x0 + ((j + 0.5) / n) * (x1 - x0)];
    if (inside(p, a) && inside(p, b)) hits++;
  }
  const box = areaM2([[y0, x0], [y0, x1], [y1, x1], [y1, x0]]);
  return Math.min(100, Math.round(((hits / (n * n)) * box / (Math.min(areaM2(a), areaM2(b)) || 1)) * 100));
}
