// Geometry helpers for plot boundaries given as [[lat, lng], ...].
const R = 6378137;
const rad = (d) => (d * Math.PI) / 180;

// Area in square metres (spherical excess approximation; <1% error at plot scale).
function polygonAreaM2(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];
    total += rad(lng2 - lng1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((total * R * R) / 2);
}

function isValidBoundary(points) {
  return Array.isArray(points) && points.every(
    (p) => Array.isArray(p) && p.length === 2 &&
      Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
      Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180
  );
}

const bbox = (pts) => pts.reduce((b, [y, x]) => [Math.min(b[0], y), Math.min(b[1], x), Math.max(b[2], y), Math.max(b[3], x)], [Infinity, Infinity, -Infinity, -Infinity]);

function pointInPolygon([y, x], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const centroid = (pts) => {
  const [a, b, c, d] = bbox(pts);
  return [(a + c) / 2, (b + d) / 2];
};

// Estimate the overlap between two plots by sampling a grid over the shared
// bounding box. Works for any simple polygon, convex or not.
function overlap(a, b, samples = 60) {
  if (!a || !b || a.length < 3 || b.length < 3) return null;
  const A = bbox(a), B = bbox(b);
  const y0 = Math.max(A[0], B[0]), x0 = Math.max(A[1], B[1]), y1 = Math.min(A[2], B[2]), x1 = Math.min(A[3], B[3]);
  if (y0 >= y1 || x0 >= x1) return null;
  let hits = 0;
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const p = [y0 + ((i + 0.5) / samples) * (y1 - y0), x0 + ((j + 0.5) / samples) * (x1 - x0)];
      if (pointInPolygon(p, a) && pointInPolygon(p, b)) hits++;
    }
  }
  if (!hits) return null;
  const boxM2 = polygonAreaM2([[y0, x0], [y0, x1], [y1, x1], [y1, x0]]);
  const areaM2 = (hits / (samples * samples)) * boxM2;
  const smaller = Math.min(polygonAreaM2(a), polygonAreaM2(b)) || 1;
  return { area_m2: Math.round(areaM2), pct_of_smaller: Math.min(100, Math.round((areaM2 / smaller) * 100)) };
}

// All overlapping pairs among a set of records ({id, code, boundary, ...}).
// Overlaps under 2% of the smaller plot are treated as GPS noise.
function findOverlaps(records, minPct = 2) {
  const out = [];
  const withShape = records.filter((r) => Array.isArray(r.boundary) && r.boundary.length >= 3);
  for (let i = 0; i < withShape.length; i++) {
    for (let j = i + 1; j < withShape.length; j++) {
      const o = overlap(withShape[i].boundary, withShape[j].boundary);
      if (o && o.pct_of_smaller >= minPct) out.push({ a: withShape[i], b: withShape[j], ...o });
    }
  }
  return out;
}

module.exports = { polygonAreaM2, isValidBoundary, overlap, findOverlaps, pointInPolygon, centroid };
