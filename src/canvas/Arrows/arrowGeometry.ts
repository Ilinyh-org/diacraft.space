import type { Side } from '../Blocks/Block';
import { normalVector, STUB, smartConnect, buildArrowPath, extractBends, hasDoubleBack } from './arrowPath';
import type { BlockData } from '../types';
import { getAnchor } from '../utils/blocks';

export type Pt = { x: number; y: number };

export function orthoConnect(P: Pt, Q: Pt): Pt[] {
  if (Math.abs(P.x - Q.x) < 0.5 || Math.abs(P.y - Q.y) < 0.5) {
    return [];
  }
  return [{ x: Q.x, y: P.y }];
}

function isHorizontalSide(side: Side): boolean {
  return side === 'left' || side === 'right';
}

export function computeElbow(P: Pt, pSide: Side, Q: Pt, qSide: Side): Pt[] {
  const pH = isHorizontalSide(pSide);
  const qH = isHorizontalSide(qSide);
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
 * Initial orthogonal elbow waypoints for a newly created arrow.
 * Once computed, these are the arrow's permanent starting waypoints —
 * they are only changed by explicit user actions.
 */
export function initialWaypoints(
  from: BlockData,
  to: BlockData,
  fromSide: Side,
  toSide: Side
): Pt[] {
  const a = getAnchor(from, fromSide);
  const b = getAnchor(to, toSide);
  const aN = normalVector(fromSide);
  const bN = normalVector(toSide);
  const exit = { x: a.x + aN.x * STUB, y: a.y + aN.y * STUB };
  const entry = { x: b.x + bN.x * STUB, y: b.y + bN.y * STUB };
  return computeElbow(exit, fromSide, entry, toSide);
}

export function buildPathWithFixed(
  a: Pt,
  aSide: Side,
  b: Pt,
  bSide: Side,
  waypoints: Pt[]
): { points: Pt[]; fixed: boolean[]; waypointIndices: number[] } {
  const aN = normalVector(aSide);
  const bN = normalVector(bSide);
  const exit = { x: a.x + aN.x * STUB, y: a.y + aN.y * STUB };
  const entry = { x: b.x + bN.x * STUB, y: b.y + bN.y * STUB };

  const pts: Pt[] = [];
  const fixed: boolean[] = [];
  const waypointIndices: number[] = [];

  const push = (p: Pt, f: boolean) => {
    const last = pts[pts.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) {
      if (f) fixed[fixed.length - 1] = true;
      return;
    }
    pts.push(p);
    fixed.push(f);
  };

  push(a, true);
  push(exit, true);

  if (waypoints.length > 0) {
    let prev = exit;
    let incoming: Pt | null = a;
    for (const wp of waypoints) {
      for (const m of smartConnect(prev, incoming, wp)) push(m, false);
      waypointIndices.push(pts.length);
      push(wp, false);
      incoming = prev;
      prev = wp;
    }
    for (const m of smartConnect(prev, incoming, entry)) push(m, false);
  } else {
    for (const m of computeElbow(exit, aSide, entry, bSide)) push(m, false);
  }

  push(entry, true);
  push(b, true);

  return { points: pts, fixed, waypointIndices };
}

/**
 * Issue #102: clicking the "+" element must create TWO points with some
 * distance between them, so the number of points always equals the number
 * of bends.
 *
 * Finds the path segment nearest to (x, y) and replaces it with a Z: on a
 * vertical segment P→Q the new points are (c, P.y) and (c, Q.y) (horizontal
 * segment: (P.x, c) and (Q.x, c)), where c is the click projected onto the
 * perpendicular axis. Each new point is a real corner, so points == bends.
 * Returns the full new waypoint list.
 */
export function insertWaypointPair(
  a: Pt,
  aSide: Side,
  b: Pt,
  bSide: Side,
  waypoints: Pt[],
  x: number,
  y: number,
  gap = 40
): Pt[] {
  const { points, waypointIndices } = buildPathWithFixed(
    a,
    aSide,
    b,
    bSide,
    waypoints
  );
  if (points.length < 2) return [...waypoints];

  // Nearest segment to the click point.
  let bestSeg = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((x - p.x) * dx + (y - p.y) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (p.x + dx * t), y - (p.y + dy * t));
    if (d < bestDist) {
      bestDist = d;
      bestSeg = i;
    }
  }

  // Waypoint insertion index: waypoints strictly before the split segment.
  const insertAtIndex = (segIdx: number) => {
    let n = 0;
    for (const wi of waypointIndices) {
      if (wi <= segIdx) n++;
    }
    return n;
  };

  const segHorizontal = (segIdx: number) => {
    const p = points[segIdx];
    const q = points[segIdx + 1];
    return Math.abs(q.y - p.y) < 0.5;
  };

  // Z pair: both corners share the perpendicular offset; each stays on its
  // endpoint's line, so the chain stays strictly orthogonal.
  const zPair = (segIdx: number): Pt[] => {
    const p = points[segIdx];
    const q = points[segIdx + 1];
    return segHorizontal(segIdx)
      ? [
          { x: p.x, y },
          { x: q.x, y },
        ]
      : [
          { x, y: p.y },
          { x, y: q.y },
        ];
  };

  // Pocket: four corners forming a rectangular notch on the segment.
  // Needed when a 2-corner Z would absorb or double back against the
  // neighbouring bends; the pocket adds only real, fully handled corners.
  const pocket = (segIdx: number): Pt[] => {
    const p = points[segIdx];
    const g = gap;
    if (segHorizontal(segIdx)) {
      const dir = Math.sign(y - p.y) || 1;
      return [
        { x: x - g, y: p.y },
        { x: x - g, y: p.y + dir * g },
        { x: x + g, y: p.y + dir * g },
        { x: x + g, y: p.y },
      ];
    }
    const dir = Math.sign(x - p.x) || 1;
    return [
      { x: p.x, y: y - g },
      { x: p.x + dir * g, y: y - g },
      { x: p.x + dir * g, y: y + g },
      { x: p.x, y: y + g },
    ];
  };

  // Keep points == bends: drop waypoints that stopped being corners after
  // the insert (their corner was absorbed by the new Z).
  const evaluate = (segIdx: number, pair: Pt[]): { pruned: Pt[]; gain: number } | null => {
    const next = [...waypoints];
    next.splice(insertAtIndex(segIdx), 0, ...pair);
    const flat = buildArrowPath(a, aSide, b, bSide, next);
    if (hasDoubleBack(flat)) return null;
    const corners = extractBends(flat);
    const taken = corners.map(() => false);
    const pruned: Pt[] = [];
    for (const wp of next) {
      const idx = corners.findIndex(
        (c, i) =>
          !taken[i] &&
          Math.abs(c.x - wp.x) < 0.5 &&
          Math.abs(c.y - wp.y) < 0.5
      );
      if (idx === -1) continue;
      taken[idx] = true;
      pruned.push(wp);
    }
    if (pruned.length < corners.length) return null;
    return { pruned, gain: pruned.length - waypoints.length };
  };

  const firstSeg = 0;
  const lastSeg = points.length - 2;
  const candidates = Array.from(new Set([bestSeg, firstSeg, lastSeg]));
  let best: { result: Pt[]; gain: number; clicked: boolean } | null = null;
  for (const seg of candidates) {
    for (const pair of [zPair(seg), pocket(seg)]) {
      const ev = evaluate(seg, pair);
      if (!ev) continue;
      const clicked = seg === bestSeg;
      if (
        !best ||
        ev.gain > best.gain ||
        (ev.gain === best.gain && clicked && !best.clicked)
      ) {
        best = { result: ev.pruned, gain: ev.gain, clicked };
      }
    }
  }
  return best ? best.result : [...waypoints];
}
