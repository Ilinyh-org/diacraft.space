import { describe, it, expect } from 'vitest';
import {
  toggleBlockSelection,
  toggleArrowSelection,
  computeMultiDragPositions,
  type PositionMap,
} from '../selection';

describe('toggleBlockSelection', () => {
  it('plain click selects only that block', () => {
    const next = toggleBlockSelection(['a', 'b'], 'a', 'c', false);
    expect(next).toEqual({ selectedIds: ['c'], selectedId: 'c' });
  });

  it('ctrl-click adds a block to the selection', () => {
    const next = toggleBlockSelection(['a'], 'a', 'b', true);
    expect(next).toEqual({ selectedIds: ['a', 'b'], selectedId: 'b' });
  });

  it('ctrl-click on a selected block deselects it completely', () => {
    const next = toggleBlockSelection(['a', 'b'], 'b', 'b', true);
    expect(next).toEqual({ selectedIds: ['a'], selectedId: null });
  });

  it('ctrl-click on the only selected block clears the selection', () => {
    const next = toggleBlockSelection(['a'], 'a', 'a', true);
    expect(next).toEqual({ selectedIds: [], selectedId: null });
  });

  it('keeps the primary selection when it stays in the multi-selection', () => {
    const next = toggleBlockSelection(['a', 'b'], 'a', 'b', true);
    expect(next).toEqual({ selectedIds: ['a'], selectedId: 'a' });
  });
});

describe('toggleArrowSelection (issue #133)', () => {
  it('plain click selects only that arrow', () => {
    const next = toggleArrowSelection(['a1', 'a2'], 'a1', 'a3', false);
    expect(next).toEqual({ selectedIds: ['a3'], selectedId: 'a3' });
  });

  it('ctrl-click adds an arrow to the selection', () => {
    const next = toggleArrowSelection(['a1'], 'a1', 'a2', true);
    expect(next).toEqual({ selectedIds: ['a1', 'a2'], selectedId: 'a2' });
  });

  it('ctrl-click on a selected arrow removes it from the selection', () => {
    const next = toggleArrowSelection(['a1', 'a2'], 'a2', 'a2', true);
    expect(next).toEqual({ selectedIds: ['a1'], selectedId: null });
  });
});

describe('computeMultiDragPositions (issue #138)', () => {
  const start: PositionMap = {
    a: { x: 10, y: 20 },
    b: { x: 100, y: 200 },
    c: { x: 5, y: 5 },
  };

  it('moves every block in the selection by the dragged block delta', () => {
    const next = computeMultiDragPositions(start, 'a', 30, 40);
    expect(next).toEqual({
      a: { x: 30, y: 40 },
      b: { x: 120, y: 220 },
      c: { x: 25, y: 25 },
    });
  });

  it('keeps positions unchanged for zero delta', () => {
    const next = computeMultiDragPositions(start, 'b', 100, 200);
    expect(next).toEqual(start);
  });

  it('returns an empty map when the dragged id is unknown', () => {
    expect(computeMultiDragPositions(start, 'zzz', 1, 2)).toEqual({});
  });
});
