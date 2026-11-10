import type { Dir, Level, LevelConcept, StatementKind } from './types';

/**
 * Issue #181: levels are stored in `levels.data.yml` — a YAML document with
 * a bilingual `name` and `description` plus an English `label` for every
 * level.
 *
 * The file uses a small, deliberately strict YAML subset so it parses
 * without a runtime dependency:
 *
 *     # Levels data — YAML.
 *     levels:
 *       - id: linear-1
 *         name:
 *           en: "First steps"
 *           ru: "Первые шаги"
 *         label: "1"
 *         concept: linear
 *         description:
 *           en: "Teach the robot to walk."
 *           ru: "Научите робота ходить."
 *         grid: 5x1
 *         start: "0 0 right"
 *         goal: "3 0"
 *         allowed: move turnLeft turnRight output
 *
 * Entry fields:
 *   - `id`                unique level id
 *   - `name`              nested `<lang>: <text>` map (required, e.g. en/ru)
 *   - `label`             short menu label, English only (e.g. "1", "8", "22")
 *   - `concept`           linear | conditions | loops | functions | arrays
 *   - `description`       nested `<lang>: <text>` map (required, e.g. en/ru)
 *   - `grid`              `<width>x<height>` board size in cells
 *   - `start`             `"<x> <y> <up|right|down|left>"` robot start
 *   - `goal`              `"<x> <y>"` goal cell
 *   - `allowed`           statement kinds the level permits
 *   - `walls`             `"<x,y> ..."` wall cells
 *   - `doors`             `"<x,y> ..."` password-door cells (issue #142)
 *   - `items`             `"<x,y> ..."` collectible item cells
 *   - `password`          door password
 *   - `inputName`         expected input-block name (issue #149)
 *   - `inputNames`        `"<code>=<name> | ..."` per-language names (#167)
 *   - `usesIo`            true|false — task uses Program I/O (issue #174)
 *   - `sign`              `"<x>,<y> <text>"` readable sign cell (repeatable)
 *   - `box`               `"<x>,<y> <item>"` box cell (repeatable)
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

/** Language-code shape accepted inside a nested `name:`/`description:` block. */
const LANG_CODE = /^[A-Za-z][\w-]*$/;

/** Fields whose value is a nested `<lang>: <text>` map. */
type NestedField = 'name' | 'description';
const NESTED_FIELDS: readonly NestedField[] = ['name', 'description'];

/** Fails with a useful message instead of silently producing a broken level. */
function fail(value: string, why: string): never {
  throw new Error(`levelFormat: ${why} — value: "${value}"`);
}

function parseCells(rest: string, value: string): [number, number][] {
  return rest.split(/\s+/).map((pair) => {
    const m = /^(\d+),(\d+)$/.exec(pair);
    if (!m) fail(value, `expected "x,y" cell, got "${pair}"`);
    return [Number(m[1]), Number(m[2])] as [number, number];
  });
}

/** Strips an optional layer of double quotes and unescapes YAML escapes. */
function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\(.)/g, (_, ch: string) =>
        ch === 'n' ? '\n' : ch === 't' ? '\t' : ch,
      );
  }
  return value;
}

/** Splits a `key: value` line into its two halves (first ": " wins). */
function splitField(line: string, id: string): { key: string; rest: string } {
  const sep = line.indexOf(': ');
  if (sep === -1) {
    // A bare `key:` with no value is not valid for a scalar field.
    if (/^[A-Za-z][\w-]*:$/.test(line.trim())) {
      fail(line, 'field has no value');
    }
    fail(line, `expected "key: value" in level "${id}"`);
  }
  return { key: line.slice(0, sep).trim(), rest: line.slice(sep + 2).trim() };
}

/** True when at least one language in a nested map has non-empty text. */
function hasText(map: Partial<Record<string, string>>): boolean {
  return Object.values(map).some(
    (text) => typeof text === 'string' && text.trim() !== '',
  );
}

/**
 * Parses the YAML level format into `Level` objects. Throws a descriptive
 * error on any malformed entry so bad edits fail loudly.
 */
export function parseLevels(source: string): Level[] {
  const levels: Level[] = [];
  let current: Level | null = null;

  // Nested `name:` / `description:` block state: entered when a bare
  // `<field>:` header is seen, exited when a line at the same-or-lower
  // indent appears.
  let nestedField: NestedField | null = null;
  let nestedIndent = -1;

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;

    const indent = raw.length - raw.trimStart().length;

    // Consume nested `<lang>: <text>` sub-keys while we are still indented
    // deeper than the header line.
    if (nestedField !== null) {
      if (indent <= nestedIndent) {
        nestedField = null;
      } else {
        if (!current) {
          fail(line, `${nestedField} sub-key outside of a level entry`);
        }
        const sep = line.indexOf(': ');
        if (sep === -1) {
          fail(line, `expected "<lang>: <text>" inside ${nestedField}`);
        }
        const subKey = line.slice(0, sep).trim();
        const subValue = unquote(line.slice(sep + 2).trim());
        if (!LANG_CODE.test(subKey)) {
          fail(line, `invalid language code "${subKey}" in ${nestedField}`);
        }
        current[nestedField][subKey] = subValue;
        continue;
      }
    }

    if (line === 'levels:') continue; // container key

    if (/^-\s/.test(line)) {
      const body = line.slice(2).trim();
      const { key, rest } = splitField(body, '?');
      if (key !== 'id') fail(body, 'a level entry must start with "id:"');
      current = {
        id: unquote(rest),
        name: {},
        label: '',
        concept: 'linear',
        description: {},
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

    if (!current) fail(line, 'field line outside of a level entry');

    // A bare `<field>:` header opens the matching nested block.
    if (NESTED_FIELDS.includes(line.slice(0, -1) as NestedField) && line.endsWith(':')) {
      const field = line.slice(0, -1) as NestedField;
      nestedField = field;
      nestedIndent = indent;
      continue;
    }

    const { key, rest } = splitField(line, current.id);

    switch (key) {
      case 'id':
        fail(line, 'duplicate "id" field');
        break;
      // Scalar forms of the nested fields are rejected loudly — the data
      // uses the nested form so every language lives on its own line.
      case 'name':
        fail(
          line,
          'name must use the nested form:\n' +
            '    name:\n' +
            '      en: "..."\n' +
            '      ru: "..."',
        );
        break;
      case 'description':
        fail(
          line,
          'description must use the nested form:\n' +
            '    description:\n' +
            '      en: "..."\n' +
            '      ru: "..."',
        );
        break;
      case 'label':
        current.label = unquote(rest);
        break;
      case 'concept': {
        const concept = unquote(rest) as LevelConcept;
        if (!CONCEPTS.includes(concept)) fail(line, `unknown concept "${concept}"`);
        current.concept = concept;
        break;
      }
      case 'grid': {
        const m = /^(\d+)x(\d+)$/.exec(unquote(rest));
        if (!m) fail(line, 'expected: grid: <width>x<height>');
        current.width = Number(m[1]);
        current.height = Number(m[2]);
        break;
      }
      case 'start': {
        const [x, y, dir, ...extra] = unquote(rest).split(/\s+/);
        if (extra.length > 0 || !(dir in DIR_VALUES)) {
          fail(line, 'expected: start: "<x> <y> <up|right|down|left>"');
        }
        current.start = { x: Number(x), y: Number(y), dir: DIR_VALUES[dir] };
        break;
      }
      case 'goal': {
        const [x, y, ...extra] = unquote(rest).split(/\s+/);
        if (extra.length > 0) fail(line, 'expected: goal: "<x> <y>"');
        current.goal = { x: Number(x), y: Number(y) };
        break;
      }
      case 'allowed':
        current.allowed = unquote(rest).split(/\s+/) as StatementKind[];
        break;
      case 'walls':
        current.walls = parseCells(unquote(rest), line);
        break;
      case 'doors':
        current.doors = parseCells(unquote(rest), line);
        break;
      case 'items':
        current.items = parseCells(unquote(rest), line);
        break;
      case 'password':
      case 'inputName':
        current[key] = unquote(rest);
        break;
      case 'usesIo': {
        if (rest !== 'true' && rest !== 'false') {
          fail(line, 'expected: usesIo: true|false');
        }
        current.usesIo = rest === 'true';
        break;
      }
      case 'inputNames': {
        const names: Partial<Record<string, string>> = {};
        for (const pair of unquote(rest).split(' | ')) {
          const eq = pair.indexOf('=');
          if (eq <= 0) fail(line, `expected <code>=<name>, got "${pair}"`);
          names[pair.slice(0, eq)] = pair.slice(eq + 1);
        }
        current.inputNames = names;
        break;
      }
      case 'sign': {
        const m = /^(\d+),(\d+) (.*)$/.exec(unquote(rest));
        if (!m) fail(line, 'expected: sign: "<x>,<y> <text>"');
        current.signs = [
          ...(current.signs ?? []),
          { at: [Number(m[1]), Number(m[2])] as [number, number], text: m[3] },
        ];
        break;
      }
      case 'box': {
        const m = /^(\d+),(\d+) (.*)$/.exec(unquote(rest));
        if (!m) fail(line, 'expected: box: "<x>,<y> <item>"');
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
    if (!hasText(level.name)) {
      throw new Error(`levelFormat: level "${level.id}" is missing its name`);
    }
    if (!level.label.trim()) {
      throw new Error(`levelFormat: level "${level.id}" is missing its label`);
    }
    if (!hasText(level.description)) {
      throw new Error(
        `levelFormat: level "${level.id}" is missing its description`,
      );
    }
    if (!level.width || !level.height) {
      throw new Error(`levelFormat: level "${level.id}" is missing its grid`);
    }
  }
  return levels;
}

function cells(pairs: [number, number][]): string {
  return pairs.map(([x, y]) => `${x},${y}`).join(' ');
}

/** Quotes a string as a YAML double-quoted scalar. */
function yaml(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Emits a nested `<lang>: <text>` block with language keys sorted. */
function emitNested(field: NestedField, map: Partial<Record<string, string>>): string[] {
  const lines: string[] = [`    ${field}:`];
  for (const lang of Object.keys(map).sort()) {
    const text = map[lang];
    if (typeof text === 'string') {
      lines.push(`      ${lang}: ${yaml(text)}`);
    }
  }
  return lines;
}

/**
 * Serializes levels back into the YAML format. `parseLevels` of the output
 * is always deep-equal to the input (round-trip safe).
 */
export function serializeLevels(levels: readonly Level[]): string {
  const lines: string[] = [
    '# Levels data — YAML (issue #181).',
    '# Edit freely: blank lines and # comments are ignored; each level entry is a',
    '# list item under `levels:` (see levelFormat.ts). Every level carries a',
    '# bilingual `name` (shown in the game-panel header), an English-only `label`',
    '# (shown on the levels menu buttons), and a bilingual `description`.',
    '',
    'levels:',
  ];

  for (const level of levels) {
    lines.push(`  - id: ${level.id}`);
    lines.push(...emitNested('name', level.name));
    lines.push(`    label: ${yaml(level.label)}`);
    lines.push(`    concept: ${level.concept}`);
    lines.push(...emitNested('description', level.description));
    lines.push(`    grid: ${level.width}x${level.height}`);
    lines.push(
      `    start: ${yaml(`${level.start.x} ${level.start.y} ${DIR_NAMES[level.start.dir]}`)}`,
    );
    lines.push(`    goal: ${yaml(`${level.goal.x} ${level.goal.y}`)}`);
    lines.push(`    allowed: ${level.allowed.join(' ')}`);
    if (level.usesIo === true) lines.push('    usesIo: true');
    if (level.walls.length > 0) lines.push(`    walls: ${yaml(cells(level.walls))}`);
    if (level.doors?.length) lines.push(`    doors: ${yaml(cells(level.doors))}`);
    if (level.items?.length) lines.push(`    items: ${yaml(cells(level.items))}`);
    if (level.password != null) lines.push(`    password: ${yaml(level.password)}`);
    if (level.inputName != null) lines.push(`    inputName: ${yaml(level.inputName)}`);
    if (level.inputNames != null) {
      const names = Object.entries(level.inputNames)
        .map(([code, name]) => `${code}=${name}`)
        .join(' | ');
      lines.push(`    inputNames: ${yaml(names)}`);
    }
    for (const sign of level.signs ?? []) {
      lines.push(`    sign: ${yaml(`${sign.at[0]},${sign.at[1]} ${sign.text}`)}`);
    }
    for (const box of level.boxes ?? []) {
      lines.push(`    box: ${yaml(`${box.at[0]},${box.at[1]} ${box.item}`)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
