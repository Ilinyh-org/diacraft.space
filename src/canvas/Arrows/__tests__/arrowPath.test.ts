import { describe, it, expect } from 'vitest';
import {
  buildArrowPath,
  extractBends,
  hasDoubleBack,
  type Point2D,
} from '../arrowPath';
import { initialWaypoints } from '../arrowGeometry';
import { refreshWaypointsAfterBlockMove } from '../arrowConstraints';
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

describe('hasDoubleBack', () => {
  it('detects an antiparallel zig-zag', () => {
    expect(hasDoubleBack([0, 0, 100, 0, 50, 0, 50, 100])).toBe(true);
  });
  it('accepts a clean orthogonal path', () => {
    expect(hasDoubleBack([0, 0, 100, 0, 100, 100, 200, 100])).toBe(false);
  });
});

describe('refreshWaypointsAfterBlockMove (issue #12)', () => {
  it('recomputes a clean elbow for a non-customized arrow', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const arrow = makeArrow(A, B, 'right', 'left');

    // Move B far down; the stale waypoints must be replaced by a fresh
    // elbow for the new geometry.
    const B_moved = makeBlock('B', 400, 600);
    const wps = refreshWaypointsAfterBlockMove(A, B_moved, arrow);
    expect(wps).not.toBeNull();
    expect(wps).toEqual(initialWaypoints(A, B_moved, 'right', 'left'));

    const flat = buildArrowPath(
      anchor(A, 'right'),
      arrow.fromSide,
      anchor(B_moved, 'left'),
      arrow.toSide,
      wps as Point2D[]
    );
    expect(hasDoubleBack(flat)).toBe(false);
    expect(extractBends(flat).length).toBe(2);
  });

  it('keeps waypoints of a customized arrow when the path is still clean', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const arrow: ArrowData = {
      ...makeArrow(A, B, 'right', 'left'),
      waypointsCustomized: true,
    };
    expect(refreshWaypointsAfterBlockMove(A, B, arrow)).toBeNull();
  });

  it('resets waypoints when moving the source past the first bend', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const arrow = makeArrow(A, B, 'right', 'left');

    // Move A right so its exit stub passes the stored middle waypoint,
    // but keep the blocks apart.
    const A_moved = makeBlock('A', 190, 0);
    const wps = refreshWaypointsAfterBlockMove(A_moved, B, arrow);
    expect(wps).not.toBeNull();

    const flat = buildArrowPath(
      anchor(A_moved, 'right'),
      arrow.fromSide,
      anchor(B, 'left'),
      arrow.toSide,
      wps as Point2D[]
    );
    expect(hasDoubleBack(flat)).toBe(false);
    expect(extractBends(flat).length).toBe(2);
  });

  it('resets waypoints when moving the target past the last bend', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const arrow = makeArrow(A, B, 'right', 'left');

    const B_moved = makeBlock('B', 250, 200);
    const wps = refreshWaypointsAfterBlockMove(A, B_moved, arrow);
    expect(wps).not.toBeNull();

    const flat = buildArrowPath(
      anchor(A, 'right'),
      arrow.fromSide,
      anchor(B_moved, 'left'),
      arrow.toSide,
      wps as Point2D[]
    );
    expect(hasDoubleBack(flat)).toBe(false);
  });
});

describe('buildArrowPath rendering after refresh', () => {
  it('clean path right → left keeps exactly 2 bends', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const arrow = makeArrow(A, B, 'right', 'left');
    const flat = buildArrowPath(
      anchor(A, 'right'),
      arrow.fromSide,
      anchor(B, 'left'),
      arrow.toSide,
      arrow.waypoints
    );
    expect(hasDoubleBack(flat)).toBe(false);
    expect(extractBends(flat).length).toBe(2);
  });
});
