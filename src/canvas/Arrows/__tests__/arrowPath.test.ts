import { describe, it, expect } from 'vitest';
import {
  buildArrowPath,
  extractBends,
  hasDoubleBack,
  type Point2D,
} from '../arrowPath';
import { initialWaypoints } from '../arrowGeometry';
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

function toPts(flat: number[]): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
}

describe('hasDoubleBack', () => {
  it('detects an antiparallel zig-zag', () => {
    expect(hasDoubleBack([0, 0, 100, 0, 50, 0, 50, 100])).toBe(true);
  });
  it('accepts a clean orthogonal path', () => {
    expect(hasDoubleBack([0, 0, 100, 0, 100, 100, 200, 100])).toBe(false);
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

describe('buildArrowPath collinear collapse (#116)', () => {
  it('collapses a fully aligned vertical arrow to a single a→b segment', () => {
    // Move block directly above End block, bottom → top.
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 0, 300);
    // Stale elbow waypoints from before the blocks were aligned.
    const waypoints = [
      { x: 60, y: 150 },
      { x: 60, y: 150 },
    ];
    const flat = buildArrowPath(
      anchor(A, 'bottom'),
      'bottom',
      anchor(B, 'top'),
      'top',
      waypoints
    );
    const pts = toPts(flat);
    expect(pts.length).toBe(2);
    expect(pts[0]).toEqual(anchor(A, 'bottom'));
    expect(pts[1]).toEqual(anchor(B, 'top'));
    expect(extractBends(flat).length).toBe(0);
  });

  it('collapses a fully aligned horizontal arrow to a single a→b segment', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 0);
    const waypoints = [{ x: 300, y: 30 }];
    const flat = buildArrowPath(
      anchor(A, 'right'),
      'right',
      anchor(B, 'left'),
      'left',
      waypoints
    );
    const pts = toPts(flat);
    expect(pts.length).toBe(2);
    expect(extractBends(flat).length).toBe(0);
  });

  it('keeps genuine bends on a non-aligned elbow path', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 300, 260);
    const arrow = makeArrow(A, B, 'bottom', 'top');
    const flat = buildArrowPath(
      anchor(A, 'bottom'),
      arrow.fromSide,
      anchor(B, 'top'),
      arrow.toSide,
      arrow.waypoints
    );
    expect(extractBends(flat).length).toBeGreaterThan(0);
  });
});
