import { describe, it, expect, beforeEach } from 'vitest';
import { loadState, saveState } from '../persistence';

describe('persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the fallback when nothing is saved', () => {
    const fallback = { blocks: [], arrows: [] };
    expect(loadState(fallback)).toBe(fallback);
  });

  it('saves and loads state round-trip', () => {
    const state = { blocks: [{ id: 'b1' }], arrows: [] };
    saveState(state);
    expect(loadState({ blocks: [], arrows: [] })).toEqual(state);
  });

  it('returns the fallback for corrupt JSON', () => {
    localStorage.setItem('block-diagram-state-v1', '{not json');
    expect(loadState({ ok: true })).toEqual({ ok: true });
  });

  it('returns the fallback for non-object payloads', () => {
    localStorage.setItem('block-diagram-state-v1', '42');
    expect(loadState({ ok: true })).toEqual({ ok: true });
  });
});
