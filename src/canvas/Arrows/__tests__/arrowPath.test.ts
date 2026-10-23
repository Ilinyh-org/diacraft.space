import { describe, it, expect } from 'vitest';
import {
  buildArrowPath,
  extractBends,
  hasDoubleBack,
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
