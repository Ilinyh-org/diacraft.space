import levelsSource from './levels.data.yml?raw';
import { parseLevels } from './levelFormat';
import type { Level } from './types';

/**
 * Issue #70: a 5x5 levels table — five concept rows of five numbered levels,
 * robot theme, one reference solution per level (see __tests__/levels.test.ts).
 *
 * Issue #178: the table was trimmed to 7 shipped levels (1-3, 8, 22, 26, 27).
 *
 * Row 1 (1-5)   linear algorithms
 * Row 2 (6-10)  algorithms with conditions
 * Row 3 (11-15) algorithms with loops
 * Row 4 (16-20) algorithms with functions
 * Row 5 (21-25) algorithms with structures (arrays)
 */

/**
 * Issue #169: the levels are stored in a plain, human-readable data file
 * that can be edited without touching TypeScript.
 *
 * Issue #181: the file is now `levels.data.yml` (YAML) and every level
 * carries a `name` and a `description`. See levelFormat.ts for the format.
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
