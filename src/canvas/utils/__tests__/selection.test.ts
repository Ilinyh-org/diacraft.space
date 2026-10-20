import { describe, it, expect } from 'vitest';
import {
  toggleBlockSelection,
  contextMenuSelection,
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

describe('contextMenuSelection', () => {
  it('keeps the multi-selection when the right-clicked block is in it', () => {
    const next = contextMenuSelection(['a', 'b'], 'a', 'b');
    expect(next).toEqual({ selectedIds: ['a', 'b'], selectedId: 'a' });
  });

  it('selects only the right-clicked block when it is not selected', () => {
    const next = contextMenuSelection(['a'], 'a', 'c');
    expect(next).toEqual({ selectedIds: ['c'], selectedId: 'c' });
  });
});
