import { describe, expect, it } from 'vitest';
import { runProgram } from '../types';
import type { Dir, Level, Statement, Subprograms } from '../types';
import { LEVELS } from '../levels';

/**
 * Issue #70: interpreter semantics for i/o, functions and the inventory array.
 */
const D = (d: string): Dir =>
  ({ up: 0, right: 1, down: 2, left: 3 })[d] as Dir;

describe('io statements', () => {
  it('output records the robot position for `pos`', () => {
    const level = LEVELS.find((l) => l.id === 'linear-5')!;
    const program: Statement[] = [
      { kind: 'move' },
      { kind: 'move' },
      { kind: 'move' },
      { kind: 'output', text: 'pos' },
    ];
    const result = runProgram(level, program);
    expect(result.status).toBe('win');
    expect(result.output).toContain('(3, 0)');
  });

  it('output keeps literal text and unknown slot placeholders', () => {
    const level = LEVELS.find((l) => l.id === 'linear-1')!;
    const result = runProgram(level, [{ kind: 'output', text: 'hello inv[3]' }]);
    expect(result.output).toContain('hello ?');
  });

  // Issue #142: a plain no-door level — conditions-8 is now a password
  // door level, so generic inputDir tests use their own level.
  const plain: Level = {
    id: 'io-test',
    title: 'T',
    concept: 'conditions',
    description: '',
    width: 3,
    height: 2,
    walls: [],
    start: { x: 1, y: 0, dir: 1 },
    goal: { x: 2, y: 1 },
    allowed: ['move', 'output', 'inputDir'],
  };

  it('inputDir consumes provided directions and turns the robot', () => {
    const result = runProgram(
      plain,
      [{ kind: 'move' }, { kind: 'inputDir' }, { kind: 'move' }],
      {},
      [D('down')],
    );
    expect(result.status).toBe('win');
    expect(result.frames.at(-1)).toEqual({ x: 2, y: 1, dir: 2 });
  });

  it('reports needInput when no direction was supplied', () => {
    const result = runProgram(plain, [
      { kind: 'move' },
      { kind: 'inputDir' },
    ]);
    expect(result.status).toBe('needInput');
  });
});

describe('inventory array', () => {
  it('setInv picks up the item at the current cell into a slot', () => {
    const level = LEVELS.find((l) => l.id === 'arrays-21')!;
    const result = runProgram(level, [
      { kind: 'move' },
      { kind: 'setInv', index: 0 },
      { kind: 'move' },
      { kind: 'move' },
      { kind: 'setInv', index: 1 },
      { kind: 'move' },
      { kind: 'output', text: 'got inv[0]' },
    ]);
    expect(result.status).toBe('win');
    expect(result.output.some((line) => line.startsWith('got '))).toBe(true);
    expect(result.output.some((line) => line.includes('?'))).toBe(false);
  });

  it('reports missing items in the slot as ?', () => {
    const level = LEVELS.find((l) => l.id === 'linear-1')!;
    const result = runProgram(level, [
      { kind: 'setInv', index: 0 },
      { kind: 'output', text: 'inv[0]' },
    ]);
    expect(result.output).toContain('?');
  });
});

describe('function calls', () => {
  const level = LEVELS.find((l) => l.id === 'functions-17')!;
  const subs: Subprograms = {
    leg: [{ kind: 'move' }, { kind: 'move' }],
  };

  it('a call runs the named subprogram', () => {
    const result = runProgram(
      level,
      [{ kind: 'call', name: 'leg' }, { kind: 'turnRight' }, { kind: 'call', name: 'leg' }],
      subs,
    );
    expect(result.status).toBe('win');
  });

  it('an unknown subprogram is a no-op that cannot win silently', () => {
    const result = runProgram(level, [{ kind: 'call', name: 'ghost' }]);
    expect(result.status).not.toBe('win');
  });

  it('recursive calls stop before hanging forever', () => {
    const subs: Subprograms = { a: [{ kind: 'call', name: 'a' }] };
    const result = runProgram(
      LEVELS.find((l) => l.id === 'linear-1')!,
      [{ kind: 'call', name: 'a' }],
      subs,
    );
    expect(result.status).toBe('crash');
  });
});
