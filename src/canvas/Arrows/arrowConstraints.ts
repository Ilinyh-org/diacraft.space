import type { ArrowData, BlockData } from '../types';
import { getAnchor } from '../utils/blocks';
import { buildPathWithFixed, initialWaypoints, type Pt } from './arrowGeometry';
import { buildArrowPath, hasDoubleBack } from './arrowPath';

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
 * After a block move, stored waypoints are absolute and can end up behind
 * the arrow's exit or entry stub, producing redundant bends.
 *
 * - Arrows the user never shaped (`waypointsCustomized` falsy) always
 *   re-route to the clean elbow for the new geometry — moving a block can
 *   never introduce stray bends on them.
 * - Customized arrows only reset when the current path truly doubles back
 *   on itself; the user's bends are otherwise preserved.
 *
 * Returns null when the existing waypoints are still fine.
 */
export function refreshWaypointsAfterBlockMove(
  from: BlockData,
  to: BlockData,
  arrow: ArrowData
): Pt[] | null {
  if (!arrow.waypointsCustomized) {
    return initialWaypoints(from, to, arrow.fromSide, arrow.toSide);
  }
  const a = getAnchor(from, arrow.fromSide);
  const b = getAnchor(to, arrow.toSide);
  const flat = buildArrowPath(a, arrow.fromSide, b, arrow.toSide, arrow.waypoints);
  if (!hasDoubleBack(flat)) return null;
  return initialWaypoints(from, to, arrow.fromSide, arrow.toSide);
}

/**
 * Move the waypoint at `bendIndex` by (dx, dy).
 * Waypoints transitively connected along the perpendicular axis move too,
 * preserving orthogonality without creating new bends.
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

  const xGroup = expandVertical(orient, new Set([pathIdx]));
  const yGroup = expandHorizontal(orient, new Set([pathIdx]));

  const xBlocked = Array.from(xGroup).some((i) => fixed[i]);
  const yBlocked = Array.from(yGroup).some((i) => fixed[i]);

  if (xBlocked && yBlocked) return null;

  let axis: 'x' | 'y';
  if (xBlocked) axis = 'y';
  else if (yBlocked) axis = 'x';
  else axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';

  const group = axis === 'x' ? xGroup : yGroup;
  const delta = axis === 'x' ? dx : dy;

  const newPoints = points.map((p) => ({ ...p }));
  for (const i of group) {
    if (fixed[i]) continue;
    if (axis === 'x') newPoints[i].x += delta;
    else newPoints[i].y += delta;
  }

  return waypointIndices.map((i) => newPoints[i]);
}
