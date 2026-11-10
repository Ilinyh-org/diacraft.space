export type Point = { x: number; y: number };

/** Resample a stroke so it contains exactly `n` equally-spaced points. */
export function resample(points: Point[], n: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return Array(n).fill(points[0]);

  const totalLen = pathLength(points);
  const interval = totalLen / (n - 1);
  const out: Point[] = [points[0]];
  let D = 0;
  let i = 1;

  while (i < points.length && out.length < n) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const d = dist(p0, p1);
    if (D + d >= interval && d > 0) {
      const t = (interval - D) / d;
      const q = {
        x: p0.x + t * (p1.x - p0.x),
        y: p0.y + t * (p1.y - p0.y),
      };
      out.push(q);
      points.splice(i, 0, q);
      // Continue from the inserted point: after the splice, points[i] is q
      // and points[i + 1] is the original p1, so advancing i makes the next
      // segment start at q. Without this, a sub-segment that exactly equals
      // the interval re-inserts the same point forever (t == 1), filling the
      // output with duplicates.
      i += 1;
      D = 0;
    } else {
      D += d;
      i += 1;
    }
  }

  while (out.length < n) out.push(points[points.length - 1]);
  return out;
}

/** Compute the total length of a polyline. */
export function pathLength(points: Point[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += dist(points[i - 1], points[i]);
  return d;
}

/** Euclidean distance between two points. */
export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Bounding box of a set of points. */
export function boundingBox(points: Point[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Translate points so their centroid is at (0, 0).
 * Returns a new array; does not mutate input.
 */
export function translateToOrigin(points: Point[]): Point[] {
  if (points.length === 0) return [];
  let cx = 0,
    cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  return points.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

/**
 * Scale points (1D, aspect-preserving) so the larger of width/height fits
 * within `size`. The $P algorithm uses this non-uniformly, but uniform scale
 * is more intuitive for hand-drawn shapes. We keep the aspect ratio.
 */
export function scaleToSquare(points: Point[], size: number): Point[] {
  const bb = boundingBox(points);
  const maxDim = Math.max(bb.width, bb.height);
  if (maxDim === 0) return points.map(() => ({ x: 0, y: 0 }));
  const s = size / maxDim;
  return points.map((p) => ({ x: p.x * s, y: p.y * s }));
}
