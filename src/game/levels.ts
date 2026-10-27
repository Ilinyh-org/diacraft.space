import levelsSource from './levels.data.txt?raw';
import { parseLevels } from './levelFormat';
import type { Level } from './types';

/**
 * Issue #70: a 5x5 levels table — five concept rows of five numbered levels,
 * robot theme, one reference solution per level (see __tests__/levels.test.ts).
 *
 * Row 1 (1-5)   linear algorithms
 * Row 2 (6-10)  algorithms with conditions
 * Row 3 (11-15) algorithms with loops
 * Row 4 (16-20) algorithms with functions
 * Row 5 (21-25) algorithms with structures (arrays)
 */

/**
 * Issue #117: levels whose task actually uses Program I/O (input directions
 * or output lines in the reference task). Only these levels show the
 * Program I/O line on their page.
 */
export const IO_LEVEL_IDS: ReadonlySet<string> = new Set([
  'linear-5',
  'conditions-8',
  'conditions-9',
  'conditions-10',
  'loops-12',
  'loops-14',
  'functions-20',
  'arrays-21',
  'arrays-22',
  'arrays-23',
  'arrays-24',
  'arrays-25',
  'arrays-26',
  'arrays-27',
]);

/**
 * Issue #169: the 25 shipped levels are stored in `levels.data.txt` — a
 * plain, human-readable text format that can be edited without touching
 * TypeScript. See levelFormat.ts for the format and its parser.
 */
export const LEVELS: Level[] = parseLevels(levelsSource);
