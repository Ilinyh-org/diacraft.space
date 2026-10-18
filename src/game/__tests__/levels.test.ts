import { describe, expect, it } from 'vitest';
import { runProgram } from '../types';
import type { Statement } from '../types';
import { LEVELS } from '../levels';

/**
 * Reference solutions: every shipped level must be winnable with the commands
 * the level allows.
 */
const SOLUTIONS: Record<string, Statement[]> = {
  'linear-1': [
    { kind: 'move' },
    { kind: 'move' },
    { kind: 'move' },
  ],
  'linear-2': [
    { kind: 'move' },
    { kind: 'move' },
    { kind: 'turnRight' },
    { kind: 'move' },
    { kind: 'move' },
  ],
  'conditions-1': [
    { kind: 'move' },
    { kind: 'ifWall', then: [{ kind: 'turnRight' }, { kind: 'move' }, { kind: 'turnLeft' }, { kind: 'move' }], else: [] },
  ],
  'loops-1': [{ kind: 'repeat', times: 7, body: [{ kind: 'move' }] }],
  'combined-1': [
    { kind: 'move' },
    { kind: 'move' },
    { kind: 'turnRight' },
    { kind: 'turnRight' },
    { kind: 'move' },
    { kind: 'move' },
    { kind: 'turnLeft' },
    { kind: 'move' },
    { kind: 'move' },
    { kind: 'turnLeft' },
    { kind: 'move' },
    { kind: 'move' },
    { kind: 'turnRight' },
    { kind: 'move' },
    { kind: 'move' },
  ],
};

describe('levels', () => {
  it('have unique ids', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  it('start on an open cell inside the grid', () => {
    for (const level of LEVELS) {
      const isWall = level.walls.some(
        ([x, y]) => x === level.start.x && y === level.start.y,
      );
      expect(isWall, level.id).toBe(false);
      expect(level.start.x, level.id).toBeLessThan(level.width);
      expect(level.start.y, level.id).toBeLessThan(level.height);
    }
  });

  it('have goals on open cells inside the grid', () => {
    for (const level of LEVELS) {
      const isWall = level.walls.some(
        ([x, y]) => x === level.goal.x && y === level.goal.y,
      );
      expect(isWall, level.id).toBe(false);
    }
  });

  it('each have a reference solution that wins', () => {
    for (const level of LEVELS) {
      const solution = SOLUTIONS[level.id];
      expect(solution, `missing solution for ${level.id}`).toBeDefined();
      const result = runProgram(level, solution);
      expect(result.status, level.id).toBe('win');
    }
  });
});
