import { describe, expect, it } from 'vitest';
import { runProgram, stepStatement, isDoorAt } from '../types';
import type { Dir, Level, Statement } from '../types';

/**
 * Issue #142: a new square type — the door with a password. The flag beyond
 * the door is unreachable while the door is closed; an input block feeds the
 * password from the level task text and opens the door.
 */
const doorLevel: Level = {
  id: 'door-test',
  name: 'Test',
  title: 'T',
  concept: 'conditions',
  description: '',
  width: 3,
  height: 1,
  walls: [],
  doors: [[1, 0]],
  password: '1234',
  start: { x: 0, y: 0, dir: 1 },
  goal: { x: 2, y: 0 },
  allowed: ['move', 'output', 'inputDir'],
};

const mv: Statement = { kind: 'move' };
const input: Statement = { kind: 'inputDir' };

describe('issue #142: door with password', () => {
  it('isDoorAt recognises door cells', () => {
    expect(isDoorAt(doorLevel, 1, 0)).toBe(true);
    expect(isDoorAt(doorLevel, 0, 0)).toBe(false);
  });

  it('crashes when the robot walks into a closed door', () => {
    const result = runProgram(doorLevel, [mv, mv], {}, []);
    expect(result.status).toBe('crash');
  });

  it('opens the door with the correct password and wins', () => {
    const result = runProgram(doorLevel, [input, mv, mv], {}, [], ['1234']);
    expect(result.status).toBe('win');
  });

  it('crashes on a wrong password', () => {
    const result = runProgram(doorLevel, [input, mv, mv], {}, [], ['0000']);
    expect(result.status).toBe('crash');
  });

  it('compares passwords case-insensitively and trims whitespace', () => {
    const result = runProgram(doorLevel, [input, mv, mv], {}, [], ['  1234 ']);
    expect(result.status).toBe('win');
  });

  it('leaves the frame unchanged when stepStatement hits a closed door', () => {
    const frame = { x: 0, y: 0, dir: 1 as Dir };
    const next = stepStatement(doorLevel, frame, mv);
    expect(next.crashed).toBe(true);
    expect(next.frame).toEqual(frame);
  });

  it('lets stepStatement pass once the door is open', () => {
    const frame = { x: 0, y: 0, dir: 1 as Dir };
    const next = stepStatement(doorLevel, frame, mv, new Set(['1,0']));
    expect(next.crashed).toBe(false);
    expect(next.frame.x).toBe(1);
  });

  it('keeps plain wall behavior for levels without doors', () => {
    const walled: Level = { ...doorLevel, doors: undefined, walls: [[1, 0]] };
    const result = runProgram(walled, [mv, mv], {}, []);
    expect(result.status).toBe('crash');
    const open: Level = { ...doorLevel, doors: undefined };
    expect(runProgram(open, [mv, mv], {}, []).status).toBe('win');
  });
});
