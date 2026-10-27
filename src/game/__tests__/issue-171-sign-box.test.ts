import { describe, expect, it } from 'vitest';
import { runProgram } from '../types';
import type { Level, Statement } from '../types';

/**
 * Issue #171: new level elements — signs (read with a `read` action block)
 * and boxes (open with an `open` action block). Sign text is reusable in
 * later output blocks via the `sign` placeholder.
 */
const base: Level = {
  id: 'sign-box-test',
  title: 't',
  concept: 'linear',
  description: '',
  width: 4,
  height: 1,
  walls: [],
  start: { x: 0, y: 0, dir: 1 },
  goal: { x: 3, y: 0 },
  allowed: ['move', 'output', 'read', 'open', 'setInv'],
  signs: [{ at: [1, 0], text: 'The code is 42' }],
  boxes: [{ at: [2, 0], item: 'key' }],
};

const stmts = (...s: Statement[]): Statement[] => s;

describe('issue #171: signs and boxes', () => {
  it('read prints the sign text on the current cell', () => {
    const r = runProgram(base, stmts({ kind: 'move' }, { kind: 'read' }));
    expect(r.output).toEqual(['The code is 42']);
    expect(r.status).toBe('missed');
  });

  it('read outside a sign prints nothing', () => {
    const r = runProgram(base, stmts({ kind: 'read' }));
    expect(r.output).toEqual([]);
  });

  it('the `sign` placeholder resolves to the last read text', () => {
    const r = runProgram(
      base,
      stmts({ kind: 'move' }, { kind: 'read' }, { kind: 'move' }, { kind: 'output', text: 'got: sign' }),
    );
    expect(r.output).toEqual(['The code is 42', 'got: The code is 42']);
  });

  it('open makes the box item collectible with inv[n] = item', () => {
    const r = runProgram(
      base,
      stmts(
        { kind: 'move' },
        { kind: 'move' },
        { kind: 'open' },
        { kind: 'setInv', index: 0 },
        { kind: 'move' },
        { kind: 'output', text: 'inv[0]' },
      ),
    );
    expect(r.output).toEqual(['key']);
    expect(r.status).toBe('win');
  });

  it('without open the box item is not collectible', () => {
    const r = runProgram(
      base,
      stmts(
        { kind: 'move' },
        { kind: 'move' },
        { kind: 'setInv', index: 0 },
        { kind: 'output', text: 'inv[0]' },
      ),
    );
    expect(r.output).toEqual(['?']);
  });
});
