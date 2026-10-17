import { describe, it, expect } from 'vitest';
import { initialWaypoints } from '../arrowGeometry';
import { applyBendDrag } from '../arrowConstraints';
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
  fromId: string,
  toId: string,
  fromSide: 'top' | 'right' | 'bottom' | 'left',
  toSide: 'top' | 'right' | 'bottom' | 'left',
  fromBlock: BlockData,
  toBlock: BlockData
): ArrowData {
  return {
    id: 'a1',
    fromBlockId: fromId,
    fromSide,
    toSide,
    toBlockId: toId,
    waypoints: initialWaypoints(fromBlock, toBlock, fromSide, toSide),
  };
}

describe('initialWaypoints', () => {
  it('right → left diagonal gives 2 bends', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const wps = initialWaypoints(A, B, 'right', 'left');
    expect(wps.length).toBe(2);
  });

  it('never returns more than 2 bends', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const combos: Array<
      ['top' | 'right' | 'bottom' | 'left', 'top' | 'right' | 'bottom' | 'left']
    > = [
      ['right', 'left'],
      ['left', 'right'],
      ['top', 'bottom'],
      ['bottom', 'top'],
      ['right', 'top'],
      ['right', 'bottom'],
      ['left', 'top'],
      ['left', 'bottom'],
    ];
    for (const [fs, ts] of combos) {
      const wps = initialWaypoints(A, B, fs, ts);
      expect(wps.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('applyBendDrag', () => {
  it('does not change waypoint count (no block move)', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const arrow = makeArrow('A', 'B', 'right', 'left', A, B);
    const initial = arrow.waypoints.length;
    for (let i = 0; i < initial; i++) {
      const next = applyBendDrag(A, B, arrow, i, 30, 30);
      if (next === null) continue;
      expect(next.length).toBe(initial);
    }
  });

  it('repeatedly dragging the same bend keeps the count stable', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    let arrow = makeArrow('A', 'B', 'right', 'left', A, B);
    const initial = arrow.waypoints.length;

    for (let step = 0; step < 5; step++) {
      const next = applyBendDrag(A, B, arrow, 0, 10, 10);
      expect(next).not.toBeNull();
      expect(next!.length).toBe(initial);
      arrow = { ...arrow, waypoints: next! };
    }
  });

  it('keeps count stable when a block has moved between drags', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    let arrow = makeArrow('A', 'B', 'right', 'left', A, B);
    const initial = arrow.waypoints.length;

    let next = applyBendDrag(A, B, arrow, 0, 10, 0);
    expect(next).not.toBeNull();
    expect(next!.length).toBe(initial);
    arrow = { ...arrow, waypoints: next! };

    const B2 = makeBlock('B', 500, 400);
    next = applyBendDrag(A, B2, arrow, 0, 20, 0);
    expect(next).not.toBeNull();
    expect(next!.length).toBe(initial);

    arrow = { ...arrow, waypoints: next! };
    next = applyBendDrag(A, B2, arrow, 0, 20, 0);
    expect(next).not.toBeNull();
    expect(next!.length).toBe(initial);
  });

  it('survives a stress sequence of drags and block moves', () => {
    const A = makeBlock('A', 0, 0);
    let B = makeBlock('B', 400, 200);
    let arrow = makeArrow('A', 'B', 'right', 'left', A, B);
    const initial = arrow.waypoints.length;

    for (let step = 0; step < 30; step++) {
      if (arrow.waypoints.length === 0) break;
      const idx = step % arrow.waypoints.length;
      const dx = (step % 5) * 15 - 30;
      const dy = (step % 3) * 15 - 15;
      const next = applyBendDrag(A, B, arrow, idx, dx, dy);
      if (next === null) continue;
      expect(next.length).toBe(initial);
      arrow = { ...arrow, waypoints: next };

      if (step % 4 === 0) {
        B = makeBlock('B', 300 + step * 10, 100 + step * 5);
      }
    }
  });

  it('returns null when the arrow has no waypoints', () => {
    const A = makeBlock('A', 0, 0);
    const B = makeBlock('B', 400, 200);
    const arrow: ArrowData = {
      id: 'a1',
      fromBlockId: 'A',
      fromSide: 'right',
      toSide: 'left',
      toBlockId: 'B',
      waypoints: [],
    };
    expect(applyBendDrag(A, B, arrow, 0, 10, 10)).toBeNull();
  });
});
