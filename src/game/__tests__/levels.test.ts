import { describe, expect, it } from 'vitest';
import { runProgram } from '../types';
import type { Dir, Statement } from '../types';
import { LEVELS } from '../levels';

const mv = (n = 1): Statement[] => Array.from({ length: n }, () => ({ kind: 'move' }));
const tl: Statement = { kind: 'turnLeft' };
const tr: Statement = { kind: 'turnRight' };

/**
 * Reference solutions: every shipped level must be winnable with the commands
 * the level allows (issue #70: 5 rows x 5 levels).
 */
const SOLUTIONS: Record<string, Statement[]> = {
  // Row 1 — linear algorithms (1-5)
  'linear-1': mv(3),
  'linear-2': [...mv(2), tr, ...mv(1)],
  'linear-3': [...mv(2), tr, ...mv(2), tr, ...mv(2)],  'linear-4': [...mv(1), tr, ...mv(2), tl, ...mv(3), tl, ...mv(2)],
  'linear-5': [...mv(3), { kind: 'output', text: 'pos' }],

  // Row 2 — algorithms with conditions (6-10)
  'conditions-6': [
    ...mv(1),
    { kind: 'ifWall', then: [tr, ...mv(1), tl, ...mv(1)], else: [] },
  ],
  'conditions-7': [
    { kind: 'ifWall', then: [tr, ...mv(1), tl, ...mv(3)], else: [] },
  ],
  'conditions-8': [{ kind: 'inputDir' }, ...mv(2)],
  'conditions-9': [
    ...mv(1),
    { kind: 'inputDir' },
    ...mv(2),
    { kind: 'inputDir' },
    ...mv(1),
  ],
  'conditions-10': [
    ...mv(1),
    { kind: 'ifWall', then: [tr, ...mv(2), tl], else: [] },
    ...mv(1),
    { kind: 'output', text: 'pos' },
  ],

  // Row 3 — algorithms with loops (11-15)
  'loops-11': [{ kind: 'repeat', times: 7, body: mv(1) }],
  'loops-12': [{ kind: 'repeat', times: 3, body: mv(1) }, { kind: 'output', text: 'pos' }],
  'loops-13': [
    { kind: 'repeat', times: 2, body: [{ kind: 'ifWall', then: [tr, ...mv(1), tl, ...mv(1)], else: mv(1) }] },
    ...mv(1),
  ],
  'loops-14': [
    { kind: 'repeat', times: 3, body: [{ kind: 'ifWall', then: [tr, ...mv(1), tl, ...mv(1)], else: mv(1) }] },
    { kind: 'repeat', times: 3, body: mv(1) },
    { kind: 'output', text: 'pos' },
  ],
  'loops-15': [
    { kind: 'repeat', times: 2, body: [{ kind: 'ifWall', then: [tr, ...mv(2), tl], else: mv(1) }] },
    ...mv(1),
  ],

  // Row 4 — algorithms with functions (16-20)
  'functions-16': [{ kind: 'call', name: 'walk' }],
  'functions-17': [{ kind: 'call', name: 'leg' }, tr, { kind: 'call', name: 'leg' }],
  'functions-18': [{ kind: 'call', name: 'safe' }, { kind: 'call', name: 'safe' }, { kind: 'call', name: 'safe' }],
  'functions-19': [{ kind: 'call', name: 'pair' }, tr, { kind: 'call', name: 'pair' }],
  'functions-20': [{ kind: 'call', name: 'leg' }, { kind: 'inputDir' }, { kind: 'call', name: 'leg' }],

  // Row 5 — algorithms with structures/arrays (21-25)
  'arrays-21': [
    ...mv(1), { kind: 'setInv', index: 0 },
    ...mv(1), ...mv(1), { kind: 'setInv', index: 1 },
    ...mv(1),
    { kind: 'output', text: 'inv[0]' },
    { kind: 'output', text: 'inv[1]' },
  ],
  'arrays-22': [
    ...mv(1), { kind: 'setInv', index: 0 },
    tr, ...mv(1), { kind: 'setInv', index: 1 },
    tl, ...mv(2),
    { kind: 'output', text: 'collected inv[0] and inv[1]' },
  ],
  'arrays-23': [
    { kind: 'ifWall', then: [tr, ...mv(1)], else: [] },
    { kind: 'setInv', index: 0 },
    tl, ...mv(3),
    { kind: 'output', text: 'inv[0]' },
  ],
  'arrays-24': [
    ...mv(1), { kind: 'setInv', index: 0 },
    ...mv(1), { kind: 'setInv', index: 1 },
    ...mv(1), { kind: 'setInv', index: 2 },
    ...mv(1),
    { kind: 'output', text: 'inv[0] inv[1] inv[2]' },
  ],
  'arrays-25': [
    ...mv(1),
    { kind: 'ifWall', then: [tr, ...mv(2), tl], else: [] },
    { kind: 'setInv', index: 0 },
    ...mv(1),
    ...mv(1), { kind: 'setInv', index: 1 },
    ...mv(1),
    { kind: 'output', text: 'inv[0]' },
    { kind: 'output', text: 'inv[1]' },
  ],
  // Issue #171 — new elements: signs and boxes.
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

const INPUTS: Record<string, string[]> = {
  'conditions-9': ['right', 'down'],
  'functions-20': ['down'],
};

/** Issue #142: passwords typed into the input block on door levels. */
const PASSWORDS: Record<string, string[]> = {
  'conditions-8': ['1234'],
};

/** Subprogram flowcharts used by row 4 reference solutions. */
const SUBS: Record<string, Record<string, Statement[]>> = {
  'functions-16': { walk: mv(3) },
  'functions-17': { leg: mv(2) },
  'functions-18': {
    safe: [{ kind: 'ifWall', then: [tr, ...mv(1), tl], else: mv(1) }],
  },
  'functions-19': {
    pair: [{ kind: 'call', name: 'step' }, { kind: 'call', name: 'step' }],
    step: mv(1),
  },
  'functions-20': { leg: mv(2) },
};

const ROW_CONCEPTS = [
  'linear',
  'conditions',
  'loops',
  'functions',
  'arrays',
] as const;

const ALLOWED_BY_ROW: string[][] = [
  ['move', 'turnLeft', 'turnRight', 'output'],
  ['move', 'turnLeft', 'turnRight', 'output', 'ifWall', 'inputDir'],
  ['move', 'turnLeft', 'turnRight', 'output', 'ifWall', 'inputDir', 'repeat'],
  ['move', 'turnLeft', 'turnRight', 'output', 'ifWall', 'inputDir', 'repeat', 'call'],
  ['move', 'turnLeft', 'turnRight', 'output', 'ifWall', 'inputDir', 'repeat', 'call', 'setInv', 'read', 'open'],
];

describe('levels (#70: 5x5 table + #171 elements)', () => {
  it('contain exactly 27 levels, five per concept row', () => {
    expect(LEVELS).toHaveLength(27);
    for (let row = 0; row < 5; row += 1) {
      const slice = LEVELS.slice(row * 5, row * 5 + 5);
      for (const level of slice) {
        expect(level.concept, level.id).toBe(ROW_CONCEPTS[row]);
      }
    }
  });

  it('respect the allowed command set of their row', () => {
    LEVELS.forEach((level, i) => {
      for (const kind of level.allowed) {
        expect(ALLOWED_BY_ROW[Math.min(4, Math.floor(i / 5))], level.id).toContain(kind);
      }
    });
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

  it('array rows carry items for the robot to collect', () => {
    // Issue #171: levels 26-27 use signs/boxes instead of floor items.
    for (const level of LEVELS.slice(20, 25)) {
      expect((level.items ?? []).length, level.id).toBeGreaterThan(0);
    }
  });

  it('each have a reference solution that wins', () => {
    for (const level of LEVELS) {
      const solution = SOLUTIONS[level.id];
      expect(solution, `missing solution for ${level.id}`).toBeDefined();
      const inputs = (INPUTS[level.id] ?? []).map(
        (d) => ({ up: 0, right: 1, down: 2, left: 3 })[d] as Dir,
      );
      const result = runProgram(
        level,
        solution,
        SUBS[level.id] ?? {},
        inputs,
        PASSWORDS[level.id] ?? [],
      );
      expect(result.status, level.id).toBe('win');
    }
  });
});
