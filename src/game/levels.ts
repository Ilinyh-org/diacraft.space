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
 * Issue #169: the 27 shipped levels are stored in `levels.data.txt` — a
 * plain, human-readable text format that can be edited without touching
 * TypeScript. See levelFormat.ts for the format and its parser.
 */
export const LEVELS: Level[] = parseLevels(levelsSource);

/**
 * Issue #117: levels whose task actually uses Program I/O (input directions
 * or output lines in the reference task). Only these levels show the
 * Program I/O line on their page.
 *
 * Issue #174: derived from the `usesIo` flags in `levels.data.txt` instead
 * of a hardcoded TypeScript list.
 */
export const IO_LEVEL_IDS: ReadonlySet<string> = new Set(
  LEVELS.filter((level) => level.usesIo === true).map((level) => level.id),
);
