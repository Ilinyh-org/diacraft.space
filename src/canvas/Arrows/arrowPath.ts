import type { Side } from '../Blocks/Block';

export const STUB = 20;

export type Point2D = { x: number; y: number };
export type Waypoint = { x: number; y: number };

export function normalVector(side: Side): Point2D {
  switch (side) {
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
  }
}

export function isHorizontal(side: Side): boolean {
  return side === 'left' || side === 'right';
}

function dedupe(pts: Point2D[]): Point2D[] {
  const out: Point2D[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (
      !last ||
      Math.abs(last.x - p.x) > 0.5 ||
      Math.abs(last.y - p.y) > 0.5
    ) {
      out.push(p);
    }
  }
  return out;
}

function orthoConnect(P: Point2D, Q: Point2D): Point2D[] {
  if (Math.abs(P.x - Q.x) < 0.5 || Math.abs(P.y - Q.y) < 0.5) {
    return [];
  }
  return [{ x: Q.x, y: P.y }];
}

/**
 * Orthogonal L-connector from `prev` to `target` that avoids doubling back:
 * when the default horizontal-first elbow ({target.x, prev.y}) would send the
 * segment opposite to the direction of the incoming segment, it connects
 * vertical-first instead (or vice versa). This prevents redundant
 * zig-zag bends when a block is moved past a stored waypoint.
 */
export function smartConnect(
  prev: Point2D,
  incoming: Point2D | null,
  target: Point2D
): Point2D[] {
  const horizontalFirst = orthoConnect(prev, target);
  if (horizontalFirst.length === 0) return [];
  if (!incoming) return horizontalFirst;

  const incomingHorizontal = Math.abs(incoming.y - prev.y) < 0.5;
  if (incomingHorizontal) {
    const inDir = Math.sign(prev.x - incoming.x);
    const outDir = Math.sign(target.x - prev.x);
    if (inDir !== 0 && outDir !== 0 && inDir !== outDir) {
      return [{ x: prev.x, y: target.y }];
    }
  } else {
    const inDir = Math.sign(prev.y - incoming.y);
    const outDir = Math.sign(target.y - prev.y);
    if (inDir !== 0 && outDir !== 0 && inDir !== outDir) {
      return horizontalFirst;
    }
  }
  return horizontalFirst;
}

function computeElbow(
  P: Point2D,
  pSide: Side,
  Q: Point2D,
  qSide: Side
): Point2D[] {
  const pH = isHorizontal(pSide);
  const qH = isHorizontal(qSide);
  if (pH && qH) {
    const mx = (P.x + Q.x) / 2;
    return [
      { x: mx, y: P.y },
      { x: mx, y: Q.y },
    ];
  }
  if (!pH && !qH) {
    const my = (P.y + Q.y) / 2;
    return [
      { x: P.x, y: my },
      { x: Q.x, y: my },
    ];
  }
  if (pH) {
    return [{ x: Q.x, y: P.y }];
  }
  return [{ x: P.x, y: Q.y }];
}

/**
 * True when the polyline contains two consecutive segments that are
 * antiparallel (the path visibly doubles back on itself).
 */
export function hasDoubleBack(flatPoints: number[]): boolean {
  const pts: Point2D[] = [];
  for (let i = 0; i < flatPoints.length; i += 2) {
    pts.push({ x: flatPoints[i], y: flatPoints[i + 1] });
  }
  for (let i = 2; i < pts.length; i++) {
    const dx1 = pts[i - 1].x - pts[i - 2].x;
    const dy1 = pts[i - 1].y - pts[i - 2].y;
    const dx2 = pts[i].x - pts[i - 1].x;
    const dy2 = pts[i].y - pts[i - 1].y;
    if (dx1 * dx2 + dy1 * dy2 < -1) return true;
  }
  return false;
}

export function buildArrowPath(
  a: Point2D,
  aSide: Side,
  b: Point2D,
  bSide: Side,
  waypoints: Waypoint[]
): number[] {
  const aN = normalVector(aSide);
  const bN = normalVector(bSide);
  const exit = { x: a.x + aN.x * STUB, y: a.y + aN.y * STUB };
  const entry = { x: b.x + bN.x * STUB, y: b.y + bN.y * STUB };

  const pts: Point2D[] = [a, exit];

  if (waypoints.length > 0) {
    let prev = exit;
    let incoming: Point2D | null = a;
    for (const wp of waypoints) {
      for (const m of smartConnect(prev, incoming, wp)) {
        pts.push(m);
      }
      incoming = prev;
      prev = wp;
      pts.push(wp);
    }
    for (const m of smartConnect(prev, incoming, entry)) pts.push(m);
  } else {
    pts.push(...computeElbow(exit, aSide, entry, bSide));
  }

  pts.push(entry, b);
  return collapseCollinear(dedupe(pts)).flatMap((p) => [p.x, p.y]);
}

/**
 * Issue #116: drop interior points that are collinear with their
 * neighbours, so an arrow whose anchors line up renders as a single
 * straight segment instead of redundant stub/waypoint points. The first
 * and last points are always kept.
 */
export function collapseCollinear(pts: Point2D[]): Point2D[] {
  if (pts.length <= 2) return pts;
  const out: Point2D[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];
    const cross =
      (curr.x - prev.x) * (next.y - curr.y) -
      (curr.y - prev.y) * (next.x - curr.x);
    if (Math.abs(cross) > 1) out.push(curr);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Returns only true corners of the path — points where direction changes.
 * Collinear points (like the exit/entry stubs) are filtered out, so a
 * 3-segment orthogonal path yields exactly 2 bends.
 */
export function extractBends(flatPoints: number[]): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < flatPoints.length; i += 2) {
    pts.push({ x: flatPoints[i], y: flatPoints[i + 1] });
  }
  if (pts.length <= 2) return [];

  const bends: Point2D[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
    if (cross > 1) {
      bends.push(curr);
    }
  }
  return bends;
}

export function pathMidpoint(flatPoints: number[]): Point2D {
  const pts: Point2D[] = [];
  for (let i = 0; i < flatPoints.length; i += 2) {
    pts.push({ x: flatPoints[i], y: flatPoints[i + 1] });
  }
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];

  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    lens.push(l);
    total += l;
  }

  let target = total / 2;
  for (let i = 1; i < pts.length; i++) {
    if (target <= lens[i - 1]) {
      const t = lens[i - 1] === 0 ? 0 : target / lens[i - 1];
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      };
    }
    target -= lens[i - 1];
  }
  return pts[pts.length - 1];
}
