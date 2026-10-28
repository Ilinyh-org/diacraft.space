import type { Dir, Level, LevelConcept, StatementKind } from './types';

/**
 * Issue #169: a human-readable text format for storing and editing levels.
 *
 * Levels live in `levels.data.txt` next to this module and are parsed at
 * load time, so adding or tweaking a level is a plain-text edit instead of
 * a TypeScript literal. Blank lines and `#` comments are ignored. A level
 * block starts with `level <id> "<title>" concept=<concept>` and is followed
 * by indented `key value` field lines:
 *
 *     # Row 1 · linear (1-5)
 *     level linear-1 "1" concept=linear
 *       grid 5x1
 *       start 0 0 right
 *       goal 3 0
 *       allowed move turnLeft turnRight output
 *
 * Field lines:
 *   - `description <text>`                level description (default: empty)
 *   - `grid <w>x<h>`                      board size in cells
 *   - `start <x> <y> <up|right|down|left>` robot start cell and direction
 *   - `goal <x> <y>`                      goal cell
 *   - `allowed <kinds...>`                statement kinds the level permits
 *   - `walls x,y ...`                     wall cells
 *   - `doors x,y ...`                     password-door cells (issue #142)
 *   - `items x,y ...`                     collectible item cells
 *   - `password <text>`                   door password
 *   - `inputName <text>`                  expected input-block name (issue #149)
 *   - `inputNames <code>=<name> | ...`    per-language input names (issue #167)
 *   - `usesIo <true|false>`               level task uses Program I/O (issue #174)
 *   - `sign <x>,<y> <text...>`            readable sign cell + text (issue #171)
 *   - `box <x>,<y> <item...>`             box cell + its item (issue #171)
 */

const DIR_NAMES: Record<Dir, string> = {
  0: 'up',
  1: 'right',
  2: 'down',
  3: 'left',
};

const DIR_VALUES: Record<string, Dir> = {
  up: 0,
  right: 1,
  down: 2,
  left: 3,
};

const CONCEPTS: readonly LevelConcept[] = [
  'linear',
  'conditions',
  'loops',
  'functions',
  'arrays',
];

/** Fails with a useful message instead of silently producing a broken level. */
function fail(line: string, why: string): never {
  throw new Error(`levelFormat: ${why} — line: "${line}"`);
}

function parseCells(rest: string, line: string): [number, number][] {
  return rest.split(/\s+/).map((pair) => {
    const m = /^(\d+),(\d+)$/.exec(pair);
    if (!m) fail(line, `expected "x,y" cell, got "${pair}"`);
    return [Number(m[1]), Number(m[2])] as [number, number];
  });
}

/**
 * Parses the human-readable level format into `Level` objects. Throws a
 * descriptive error on any malformed line so bad edits fail loudly.
 */
export function parseLevels(source: string): Level[] {
  const levels: Level[] = [];
  let current: Level | null = null;

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;

    if (line.startsWith('level ')) {
      const m = /^level (\S+) "(.*?)" concept=(\S+)$/.exec(line);
      if (!m) fail(line, 'expected: level <id> "<title>" concept=<concept>');
      if (!CONCEPTS.includes(m[3] as LevelConcept)) {
        fail(line, `unknown concept "${m[3]}"`);
      }
      current = {
        id: m[1],
        title: m[2],
        concept: m[3] as LevelConcept,
        description: '',
        width: 0,
        height: 0,
        walls: [],
        start: { x: 0, y: 0, dir: 1 },
        goal: { x: 0, y: 0 },
        allowed: [],
      };
      levels.push(current);
      continue;
    }

    if (!current) fail(line, 'field line outside of a level block');
    const sp = line.indexOf(' ');
    const key = sp === -1 ? line : line.slice(0, sp);
    const rest = sp === -1 ? '' : line.slice(sp + 1);

    switch (key) {
      case 'description':
        current.description = rest;
        break;
      case 'grid': {
        const m = /^(\d+)x(\d+)$/.exec(rest);
        if (!m) fail(line, 'expected: grid <width>x<height>');
        current.width = Number(m[1]);
        current.height = Number(m[2]);
        break;
      }
      case 'start': {
        const [x, y, dir, ...extra] = rest.split(/\s+/);
        if (extra.length > 0 || !(dir in DIR_VALUES)) {
          fail(line, 'expected: start <x> <y> <up|right|down|left>');
        }
        current.start = { x: Number(x), y: Number(y), dir: DIR_VALUES[dir] };
        break;
      }
      case 'goal': {
        const [x, y, ...extra] = rest.split(/\s+/);
        if (extra.length > 0) fail(line, 'expected: goal <x> <y>');
        current.goal = { x: Number(x), y: Number(y) };
        break;
      }
      case 'allowed':
        current.allowed = rest.split(/\s+/) as StatementKind[];
        break;
      case 'walls':
        current.walls = parseCells(rest, line);
        break;
      case 'doors':
        current.doors = parseCells(rest, line);
        break;
      case 'items':
        current.items = parseCells(rest, line);
        break;
      case 'password':
      case 'inputName':
        current[key] = rest;
        break;
      case 'usesIo':
        if (rest !== 'true' && rest !== 'false') {
          fail(line, 'expected: usesIo <true|false>');
        }
        current.usesIo = rest === 'true';
        break;
      case 'inputNames': {
        const names: Partial<Record<string, string>> = {};
        for (const pair of rest.split(' | ')) {
          const eq = pair.indexOf('=');
          if (eq <= 0) fail(line, `expected <code>=<name>, got "${pair}"`);
          names[pair.slice(0, eq)] = pair.slice(eq + 1);
        }
        current.inputNames = names;
        break;
      }
      case 'sign': {
        const m = /^(\d+),(\d+) (.*)$/.exec(rest);
        if (!m) fail(line, 'expected: sign <x>,<y> <text>');
        current.signs = [
          ...(current.signs ?? []),
          { at: [Number(m[1]), Number(m[2])] as [number, number], text: m[3] },
        ];
        break;
      }
      case 'box': {
        const m = /^(\d+),(\d+) (.*)$/.exec(rest);
        if (!m) fail(line, 'expected: box <x>,<y> <item>');
        current.boxes = [
          ...(current.boxes ?? []),
          { at: [Number(m[1]), Number(m[2])] as [number, number], item: m[3] },
        ];
        break;
      }
      default:
        fail(line, `unknown field "${key}"`);
    }
  }

  for (const level of levels) {
    if (!level.width || !level.height) {
      throw new Error(`levelFormat: level "${level.id}" is missing its grid`);
    }
  }
  return levels;
}

function cells(pairs: [number, number][]): string {
  return pairs.map(([x, y]) => `${x},${y}`).join(' ');
}

/** Refuses text that would corrupt the line-based format on re-parse. */
function assertOneLine(value: string, field: string, id: string): void {
  if (/["\r\n]/.test(value)) {
    throw new Error(
      `levelFormat: ${field} of level "${id}" must be one line without double quotes`,
    );
  }
}

/**
 * Serializes levels back into the human-readable format. `parseLevels`
 * of the output is always deep-equal to the input (round-trip safe).
 */
export function serializeLevels(levels: readonly Level[]): string {
  const lines: string[] = [
    '# Levels data — human-readable format (issue #169).',
    '# Edit freely: blank lines and # comments are ignored; each level block',
    '# starts with `level <id> "<title>" concept=<concept>` (see levelFormat.ts).',
    '',
  ];

  for (const level of levels) {
    assertOneLine(level.title, 'title', level.id);
    assertOneLine(level.description, 'description', level.id);
    if (level.password != null) assertOneLine(level.password, 'password', level.id);
    if (level.inputName != null) assertOneLine(level.inputName, 'inputName', level.id);

    lines.push(`level ${level.id} "${level.title}" concept=${level.concept}`);
    lines.push(`  grid ${level.width}x${level.height}`);
    lines.push(
      `  start ${level.start.x} ${level.start.y} ${DIR_NAMES[level.start.dir]}`,
    );
    lines.push(`  goal ${level.goal.x} ${level.goal.y}`);
    lines.push(`  allowed ${level.allowed.join(' ')}`);
    if (level.usesIo === true) lines.push('  usesIo true');
    if (level.description !== '') lines.push(`  description ${level.description}`);
    if (level.walls.length > 0) lines.push(`  walls ${cells(level.walls)}`);
    if (level.doors?.length) lines.push(`  doors ${cells(level.doors)}`);
    if (level.items?.length) lines.push(`  items ${cells(level.items)}`);
    if (level.password != null) lines.push(`  password ${level.password}`);
    if (level.inputName != null) lines.push(`  inputName ${level.inputName}`);
    if (level.inputNames != null) {
      const names = Object.entries(level.inputNames)
        .map(([code, name]) => `${code}=${name}`)
        .join(' | ');
      lines.push(`  inputNames ${names}`);
    }
    for (const sign of level.signs ?? []) {
      assertOneLine(sign.text, 'sign text', level.id);
      lines.push(`  sign ${sign.at[0]},${sign.at[1]} ${sign.text}`);
    }
    for (const box of level.boxes ?? []) {
      assertOneLine(box.item, 'box item', level.id);
      lines.push(`  box ${box.at[0]},${box.at[1]} ${box.item}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
