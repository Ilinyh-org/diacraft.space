import { describe, expect, it } from 'vitest';
import { runProgram } from '../types';
import type { Statement } from '../types';
import { LEVELS } from '../levels';

const mv = (n = 1): Statement[] => Array.from({ length: n }, () => ({ kind: 'move' }));
const tl: Statement = { kind: 'turnLeft' };
const tr: Statement = { kind: 'turnRight' };

/**
 * Issue #178: the level table was trimmed to 7 shipped levels (1-3, 8, 22,
 * 26, 27). Reference solutions: every shipped level must be winnable with
 * the commands the level allows.
 */
const SOLUTIONS: Record<string, Statement[]> = {
  'linear-1': mv(3),
  'linear-2': [...mv(2), tr, ...mv(1)],
  'linear-3': [...mv(2), tr, ...mv(2), tr, ...mv(2)],
  'conditions-8': [{ kind: 'inputDir' }, ...mv(2)],
  'arrays-22': [
    ...mv(1), { kind: 'setInv', index: 0 },
    tr, ...mv(1), { kind: 'setInv', index: 1 },
    tl, ...mv(2),
    { kind: 'output', text: 'collected inv[0] and inv[1]' },
  ],
  // Issue #171 — signs and boxes.
  'arrays-26': [
    ...mv(1),
    { kind: 'read' },
    { kind: 'output', text: 'sign' },
    ...mv(2),
  ],
  'arrays-27': [
    ...mv(1),
    { kind: 'open' },
    { kind: 'setInv', index: 0 },
    ...mv(2),
    tr,
    ...mv(1),
  ],
};

/** Issue #142: passwords typed into the input block on door levels. */
const PASSWORDS: Record<string, string[]> = {
  'conditions-8': ['1234'],
};

describe('levels (issue #178: trimmed to 7 shipped levels)', () => {
  it('ship exactly the 7 kept levels', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([
      'linear-1',
      'linear-2',
      'linear-3',
      'conditions-8',
      'arrays-22',
      'arrays-26',
      'arrays-27',
    ]);
  });

  it('no longer contain any of the levels removed by issue #178', () => {
    const removed = [
      'linear-4', 'linear-5',
      'conditions-6', 'conditions-7', 'conditions-9', 'conditions-10',
      'loops-11', 'loops-12', 'loops-13', 'loops-14', 'loops-15',
      'functions-16', 'functions-17', 'functions-18', 'functions-19', 'functions-20',
      'arrays-21', 'arrays-23', 'arrays-24', 'arrays-25',
    ];
    for (const id of removed) {
      expect(LEVELS.find((l) => l.id === id), id).toBeUndefined();
    }
  });

  it('have unique ids', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  it('start and end on open cells inside the grid', () => {
    for (const level of LEVELS) {
      const isWall = (x: number, y: number) =>
        level.walls.some(([wx, wy]) => wx === x && wy === y);
      expect(isWall(level.start.x, level.start.y), level.id).toBe(false);
      expect(isWall(level.goal.x, level.goal.y), level.id).toBe(false);
      for (const [ix, iy] of level.items ?? []) {
        expect(isWall(ix, iy), `${level.id} item`).toBe(false);
      }
    }
  });

  it('array level 22 carries items for the robot to collect', () => {
    const level = LEVELS.find((l) => l.id === 'arrays-22')!;
    expect(level.items?.length).toBeGreaterThan(0);
  });

  it('each have a reference solution that wins', () => {
    for (const level of LEVELS) {
      const solution = SOLUTIONS[level.id];
      expect(solution, `missing solution for ${level.id}`).toBeDefined();
      const result = runProgram(
        level,
        solution,
        {},
        [],
        PASSWORDS[level.id] ?? [],
      );
      expect(result.status, level.id).toBe('win');
    }
  });
});
