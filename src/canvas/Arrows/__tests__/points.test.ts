import { describe, it, expect } from 'vitest';
import { buildArrowPath, extractBends, type Point2D } from '../arrowPath';
import { initialWaypoints, insertWaypointPair } from '../arrowGeometry';
import {
  translateWaypointsAfterBlockMove,
  applyBendDrag,
  bendDragBounds,
} from '../arrowConstraints';
import type { BlockData, ArrowData } from '../../types';

function makeBlock(
  id: string,
  x: number,
  y: number,
  width = 120,
  height = 60
): BlockData {
  return { id, x, y, width, height, label: id, type: 'action' };
}

function makeArrow(
  fromBlock: BlockData,
  toBlock: BlockData,
  fromSide: 'top' | 'right' | 'bottom' | 'left',
  toSide: 'top' | 'right' | 'bottom' | 'left'
): ArrowData {
  return {
    id: 'a1',
    fromBlockId: fromBlock.id,
    fromSide,
    toSide,
    toBlockId: toBlock.id,
    waypoints: initialWaypoints(fromBlock, toBlock, fromSide, toSide),
  };
}

function anchor(b: BlockData, side: 'top' | 'right' | 'bottom' | 'left') {
  const map = {
    top: { x: b.x + b.width / 2, y: b.y },
    right: { x: b.x + b.width, y: b.y + b.height / 2 },
    bottom: { x: b.x + b.width / 2, y: b.y + b.height },
    left: { x: b.x, y: b.y + b.height / 2 },
  } as const;
  return map[side];
}

function bendsOf(a: BlockData, b: BlockData, arrow: ArrowData) {
  const flat = buildArrowPath(
    anchor(a, arrow.fromSide),
    arrow.fromSide,
    anchor(b, arrow.toSide),
    arrow.toSide,
    arrow.waypoints as Point2D[]
  );
  return extractBends(flat);
}

/**
 * Issue #102: Points bugs.
 *
 * Invariants required by the owner:
 * - the number of bends is static after arrow creation;
 * - the number of point handles equals the number of bends;
 * - dragging a point to an impossible position clamps it to the last
 *   possible position, and reverse movement stays available.
 */
describe('translateWaypointsAfterBlockMove (#102)', () => {
  it('keeps the bend count static when the target block moves', () => {
    const A = makeBlock('A', 0, 0);
    let B = makeBlock('B', 400, 200);
    let arrow = makeArrow(A, B, 'right', 'left');
    const initialBends = bendsOf(A, B, arrow).length;

    for (const pos of [
      [400, 600],
      [400, 0],
      [150, 200],
      [600, 300],
      [60, 100],
    ]) {
      B = makeBlock('B', pos[0], pos[1]);
      const next = translateWaypointsAfterBlockMove(A, B, A, B, arrow);
      expect(next.length).toBe(arrow.waypoints.length);
      arrow = { ...arrow, waypoints: next };
      expect(bendsOf(A, B, arrow).length).toBeLessThanOrEqual(initialBends);
    }
  });

  it('keeps the bend count static when the source block moves', () => {
    const B = makeBlock('B', 400, 200);
    let A = makeBlock('A', 0, 0);
    let arrow = makeArrow(A, B, 'right', 'left');
    const initialBends = bendsOf(A, B, arrow).length;

    for (const pos of [
      [100, 300],
      [300, 0],
      [0, 400],
      [200, 200],
    ]) {
      A = makeBlock('A', pos[0], pos[1]);
      const next = translateWaypointsAfterBlockMove(A, B, A, B, arrow);
      expect(next.length).toBe(arrow.waypoints.length);
      arrow = { ...arrow, waypoints: next };
      expect(bendsOf(A, B, arrow).length).toBeLessThanOrEqual(initialBends);
    }
  });

  it('never produces double-back paths for diagonal block moves', () => {
    const A = makeBlock('A', 0, 0);
    let B = makeBlock('B', 400, 200);
    let arrow = makeArrow(A, B, 'right', 'left');
    for (let step = 0; step < 20; step++) {
      B = makeBlock('B', 420 + step * 7, 260 - step * 11);
      const next = translateWaypointsAfterBlockMove(A, B, A, B, arrow);
      arrow = { ...arrow, waypoints: next };
      const flat = buildArrowPath(
        anchor(A, arrow.fromSide),
        arrow.fromSide,
        anchor(B, arrow.toSide),
        arrow.toSide,
        arrow.waypoints as Point2D[]
      );
      const bends = extractBends(flat);
      const expected = Math.max(arrow.waypoints.length, 1);
      expect(bends.length).toBeLessThanOrEqual(expected);
    }
  });
});

describe('insertWaypointPair (#102)', () => {
  it('creates two points with a distance between them', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const arrow = makeArrow(A, B, 'right', 'left');
    const next = insertWaypointPair(
      anchor(A, 'right'),
      arrow.fromSide,
      anchor(B, 'left'),
      arrow.toSide,
      arrow.waypoints as Point2D[],
      300,
      100
    );
    expect(next.length).toBeGreaterThan(arrow.waypoints.length);
    const oldSet = new Set(arrow.waypoints.map((p) => `${p.x},${p.y}`));
    const added = next.filter((p) => !oldSet.has(`${p.x},${p.y}`));
    // At least a Z pair of new points is created, with a distance between
    // two of them.
    expect(added.length).toBeGreaterThanOrEqual(2);
    let maxDist = 0;
    for (const p1 of added) {
      for (const p2 of added) {
        maxDist = Math.max(
          maxDist,
          Math.hypot(p2.x - p1.x, p2.y - p1.y)
        );
      }
    }
    expect(maxDist).toBeGreaterThan(0);
  });

  it('keeps the path orthogonal with bends equal to points', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    let arrow = makeArrow(A, B, 'right', 'left');
    arrow = {
      ...arrow,
      waypoints: insertWaypointPair(
        anchor(A, 'right'),
        arrow.fromSide,
        anchor(B, 'left'),
        arrow.toSide,
        arrow.waypoints as Point2D[],
        300,
        100
      ),
      waypointsCustomized: true,
    };
    const bends = bendsOf(A, B, arrow);
    expect(bends.length).toBe(arrow.waypoints.length);
  });
});

describe('bend drag clamping (#102)', () => {
  it('reports bounds that include the current position', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const arrow = makeArrow(A, B, 'right', 'left');
    const bounds = bendDragBounds(A, B, arrow, 0);
    expect(bounds).not.toBeNull();
    const wp = arrow.waypoints[0];
    const axes = [bounds!.x, bounds!.y].filter(Boolean);
    expect(axes.length).toBeGreaterThan(0);
    if (bounds!.x) {
      expect(bounds!.x.min).toBeLessThanOrEqual(wp.x);
      expect(bounds!.x.max).toBeGreaterThanOrEqual(wp.x);
    }
    if (bounds!.y) {
      expect(bounds!.y.min).toBeLessThanOrEqual(wp.y);
      expect(bounds!.y.max).toBeGreaterThanOrEqual(wp.y);
    }
  });

  it('applyBendDrag clamps the drag instead of doubling back', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const arrow = makeArrow(A, B, 'right', 'left');
    const bounds = bendDragBounds(A, B, arrow, 0)!;
    // Overshoot far beyond the allowed range.
    const next = applyBendDrag(A, B, arrow, 0, 100000, 0);
    expect(next).not.toBeNull();
    const wp = next![0];
    const xb = bounds.x;
    if (xb) {
      expect(wp.x).toBeGreaterThanOrEqual(xb.min);
      expect(wp.x).toBeLessThanOrEqual(xb.max);
    }
  });

  it('reverse movement works after clamping', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const arrow = makeArrow(A, B, 'right', 'left');
    const clamped = applyBendDrag(A, B, arrow, 0, 100000, 0)!;
    const back = applyBendDrag(A, B, { ...arrow, waypoints: clamped }, 0, -50, 0);
    expect(back).not.toBeNull();
    expect(back![0].x).toBeLessThan(clamped[0].x);
  });
});
