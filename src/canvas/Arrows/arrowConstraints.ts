import type { ArrowData, BlockData } from '../types';
import { getAnchor } from '../utils/blocks';
import { buildPathWithFixed, type Pt } from './arrowGeometry';
import { normalVector, STUB } from './arrowPath';
import type { Side } from '../Blocks/Block';

function segmentOrientation(p: Pt, q: Pt): 'H' | 'V' {
  return Math.abs(p.x - q.x) >= Math.abs(p.y - q.y) ? 'H' : 'V';
}

function orientSegments(pts: Pt[]): ('H' | 'V')[] {
  const out: ('H' | 'V')[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    out.push(segmentOrientation(pts[i], pts[i + 1]));
  }
  return out;
}

function expandVertical(
  orient: ('H' | 'V')[],
  start: Set<number>
): Set<number> {
  const g = new Set(start);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < orient.length; i++) {
      if (orient[i] !== 'V') continue;
      if (g.has(i) && !g.has(i + 1)) {
        g.add(i + 1);
        changed = true;
      }
      if (g.has(i + 1) && !g.has(i)) {
        g.add(i);
        changed = true;
      }
    }
  }
  return g;
}

function expandHorizontal(
  orient: ('H' | 'V')[],
  start: Set<number>
): Set<number> {
  const g = new Set(start);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < orient.length; i++) {
      if (orient[i] !== 'H') continue;
      if (g.has(i) && !g.has(i + 1)) {
        g.add(i + 1);
        changed = true;
      }
      if (g.has(i + 1) && !g.has(i)) {
        g.add(i);
        changed = true;
      }
    }
  }
  return g;
}

/**
 * Bounds (inclusive) for moving the bend at `bendIndex` along one axis.
 * null means the axis is blocked (its drag group contains a fixed point).
 *
 * The bend's drag group must never cross a path-adjacent point outside the
 * group: crossing would flip a segment direction (a double-back) and add a
 * visible bend that has no point handle. Issue #102: a point dragged to an
 * impossible position must stick at the last possible position.
 */
export function bendDragBounds(
  from: BlockData,
  to: BlockData,
  arrow: ArrowData,
  bendIndex: number
): { x: { min: number; max: number } | null; y: { min: number; max: number } | null } | null {
  if (arrow.waypoints.length === 0) return null;
  if (bendIndex < 0 || bendIndex >= arrow.waypoints.length) return null;

  const a = getAnchor(from, arrow.fromSide);
  const b = getAnchor(to, arrow.toSide);
  const { points, fixed, waypointIndices } = buildPathWithFixed(
    a,
    arrow.fromSide,
    b,
    arrow.toSide,
    arrow.waypoints
  );

  if (waypointIndices.length !== arrow.waypoints.length) return null;

  const pathIdx = waypointIndices[bendIndex];
  const orient = orientSegments(points);
  const PAD = 1;

  const axisBounds = (moveAxis: 'x' | 'y') => {
    // Moving along `moveAxis` shifts the group connected through the
    // perpendicular segment orientation.
    const group =
      moveAxis === 'x'
        ? expandVertical(orient, new Set([pathIdx]))
        : expandHorizontal(orient, new Set([pathIdx]));
    if (Array.from(group).some((i) => fixed[i])) return null;

    let min = -Infinity;
    let max = Infinity;
    for (const i of group) {
      const c = moveAxis === 'x' ? points[i].x : points[i].y;
      for (const j of [i - 1, i + 1]) {
        if (j < 0 || j >= points.length || group.has(j)) continue;
        const n = moveAxis === 'x' ? points[j].x : points[j].y;
        if (c > n) min = Math.max(min, n + PAD);
        else if (c < n) max = Math.min(max, n - PAD);
      }
      min = Math.min(min, c);
      max = Math.max(max, c);
    }
    return { min, max };
  };

  return { x: axisBounds('x'), y: axisBounds('y') };
}

/**
 * True when the bend at `bendIndex` cannot move on either axis because both
 * drag groups hit a fixed (anchor) point. Such a bend must stay in place
 * when the user tries to drag it.
 */
export function isBendFullyConstrained(
  from: BlockData,
  to: BlockData,
  arrow: ArrowData,
  bendIndex: number
): boolean {
  const bounds = bendDragBounds(from, to, arrow, bendIndex);
  if (!bounds) return true;
  return bounds.x === null && bounds.y === null;
}

/**
 * Move the waypoint at `bendIndex` by (dx, dy).
 * Waypoints transitively connected along the perpendicular axis move too,
 * preserving orthogonality without creating new bends.
 * The delta is clamped to the last possible position (issue #102): a point
 * dragged past an adjacent point sticks at the boundary; reverse movement
 * is always available.
 * Returns the new waypoint list (same length as input), or null if the
 * drag can't be applied (both axes locked).
 */
export function applyBendDrag(
  from: BlockData,
  to: BlockData,
  arrow: ArrowData,
  bendIndex: number,
  dx: number,
  dy: number
): Pt[] | null {
  const bounds = bendDragBounds(from, to, arrow, bendIndex);
  if (!bounds) return null;

  let axis: 'x' | 'y';
  if (bounds.x === null) axis = 'y';
  else if (bounds.y === null) axis = 'x';
  else axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';

  const range = bounds[axis];
  if (!range) return null;

  const a = getAnchor(from, arrow.fromSide);
  const b = getAnchor(to, arrow.toSide);
  const { points, fixed, waypointIndices } = buildPathWithFixed(
    a,
    arrow.fromSide,
    b,
    arrow.toSide,
    arrow.waypoints
  );

  if (waypointIndices.length !== arrow.waypoints.length) return null;

  const pathIdx = waypointIndices[bendIndex];
  const orient = orientSegments(points);

  const group =
    axis === 'x'
      ? expandVertical(orient, new Set([pathIdx]))
      : expandHorizontal(orient, new Set([pathIdx]));

  let delta = axis === 'x' ? dx : dy;
  // Clamp to the last possible position along the drag axis.
  for (const i of group) {
    if (fixed[i]) continue;
    const c = axis === 'x' ? points[i].x : points[i].y;
    delta = Math.max(range.min - c, Math.min(range.max - c, delta));
  }

  const newPoints = points.map((p) => ({ ...p }));
  for (const i of group) {
    if (fixed[i]) continue;
    if (axis === 'x') newPoints[i].x += delta;
    else newPoints[i].y += delta;
  }

  return waypointIndices.map((i) => newPoints[i]);
}

function sideAnchor(block: BlockData, side: Side): Pt {
  return getAnchor(block, side);
}

/**
 * Issue #102: the number of bends is static after arrow creation.
 *
 * After a block move, the stored waypoints are translated to the new
 * geometry so that:
 * - the waypoint count (== visible bend count) never changes;
 * - the chain stays strictly orthogonal (each consecutive pair of path
 *   points shares one coordinate), so no hidden elbows are inserted and
 *   every bend has a point handle;
 * - the user's shaping (the free coordinates of the chain) is preserved,
 *   clamped to the last possible position when a block moves past a bend.
 *
 * `prevFrom`/`prevTo` are the block positions before the move.
 */
export function translateWaypointsAfterBlockMove(
  prevFrom: BlockData,
  prevTo: BlockData,
  nextFrom: BlockData,
  nextTo: BlockData,
  arrow: ArrowData
): Pt[] {
  const waypoints = arrow.waypoints;
  if (waypoints.length === 0) return [];

  const aOld = sideAnchor(prevFrom, arrow.fromSide);
  const bOld = sideAnchor(prevTo, arrow.toSide);
  const aNew = sideAnchor(nextFrom, arrow.fromSide);
  const bNew = sideAnchor(nextTo, arrow.toSide);

  // Segment orientations from the OLD geometry define the chain structure.
  const oldPath = buildPathWithFixed(
    aOld,
    arrow.fromSide,
    bOld,
    arrow.toSide,
    waypoints
  );
  if (oldPath.waypointIndices.length !== waypoints.length) {
    return waypoints.map((p) => ({ ...p }));
  }
  const orient = orientSegments(oldPath.points);
  const PAD = 1;

  // Rebuild the chain against the NEW anchors, keeping each waypoint's
  // free coordinate at its old (clamped) value.
  const exit = {
    x: aNew.x + normalVector(arrow.fromSide).x * STUB,
    y: aNew.y + normalVector(arrow.fromSide).y * STUB,
  };
  const entry = {
    x: bNew.x + normalVector(arrow.toSide).x * STUB,
    y: bNew.y + normalVector(arrow.toSide).y * STUB,
  };

  const result: Pt[] = waypoints.map((p) => ({ ...p }));
  let prev: Pt = exit;
  for (let k = 0; k < result.length; k++) {
    const segIn = orient[oldPath.waypointIndices[k] - 1] ?? 'H';
    const isLast = k === result.length - 1;
    const segOut = orient[orient.length - 1];
    if (isLast) {
      // The last waypoint's both coordinates are fixed by its two
      // segments (to prev and to the entry anchor).
      if (segIn !== segOut) {
        if (segIn === 'H') {
          result[k].y = prev.y;
          result[k].x = entry.x;
        } else {
          result[k].x = prev.x;
          result[k].y = entry.y;
        }
      } else if (segIn === 'H') {
        result[k].y = entry.y;
        const lo = Math.min(prev.x, entry.x) + PAD;
        const hi = Math.max(prev.x, entry.x) - PAD;
        result[k].x = hi < lo ? prev.x : Math.max(lo, Math.min(hi, result[k].x));
      } else {
        result[k].x = entry.x;
        const lo = Math.min(prev.y, entry.y) + PAD;
        const hi = Math.max(prev.y, entry.y) - PAD;
        result[k].y = hi < lo ? prev.y : Math.max(lo, Math.min(hi, result[k].y));
      }
    } else if (segIn === 'H') {
      // shares y with prev; x is the free coordinate
      result[k].y = prev.y;
      const lo = Math.min(prev.x, entry.x) + PAD;
      const hi = Math.max(prev.x, entry.x) - PAD;
      result[k].x = hi < lo ? prev.x : Math.max(lo, Math.min(hi, result[k].x));
    } else {
      result[k].x = prev.x;
      const lo = Math.min(prev.y, entry.y) + PAD;
      const hi = Math.max(prev.y, entry.y) - PAD;
      result[k].y = hi < lo ? prev.y : Math.max(lo, Math.min(hi, result[k].y));
    }
    prev = result[k];
  }
  return result;
}
