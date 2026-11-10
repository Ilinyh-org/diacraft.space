import { describe, expect, it } from 'vitest';
import type { Level } from '../types';
import { parseLevels, serializeLevels } from '../levelFormat';
import { LEVELS, IO_LEVEL_IDS } from '../levels';
import levelsSource from '../levels.data.yml?raw';

describe('levelFormat (issue #181: YAML with bilingual names and descriptions)', () => {
  const sample = `# a comment

levels:
  - id: test-level
    name:
      en: "The test level"
      ru: "Тестовый уровень"
    label: "42"
    concept: loops
    description:
      en: "Reach the flag: a full-feature test."
      ru: "Доберитесь до флага: тест всех возможностей."
    grid: 4x2
    start: "1 1 left"
    goal: "3 0"
    allowed: move turnLeft turnRight output ifWall inputDir repeat call setInv
    walls: "0,0 2,1"
    doors: "3,1"
    items: "1,0"
    password: "1234"
    inputName: "Input Password"
    inputNames: "en=Input Password | ru=Ввод пароля"
    usesIo: true
    sign: "2,0 Hello sign"
    box: "0,1 key"
`;

  it('parses a full level entry into a Level object', () => {
    const [level] = parseLevels(sample);
    expect(level).toEqual<Level>({
      id: 'test-level',
      name: {
        en: 'The test level',
        ru: 'Тестовый уровень',
      },
      label: '42',
      concept: 'loops',
      description: {
        en: 'Reach the flag: a full-feature test.',
        ru: 'Доберитесь до флага: тест всех возможностей.',
      },
      width: 4,
      height: 2,
      walls: [
        [0, 0],
        [2, 1],
      ],
      doors: [[3, 1]],
      items: [[1, 0]],
      password: '1234',
      inputName: 'Input Password',
      inputNames: { en: 'Input Password', ru: 'Ввод пароля' },
      usesIo: true,
      signs: [{ at: [2, 0], text: 'Hello sign' }],
      boxes: [{ at: [0, 1], item: 'key' }],
      start: { x: 1, y: 1, dir: 3 },
      goal: { x: 3, y: 0 },
      allowed: [
        'move',
        'turnLeft',
        'turnRight',
        'output',
        'ifWall',
        'inputDir',
        'repeat',
        'call',
        'setInv',
      ],
    });
  });

  // The nested form is what makes level names and descriptions bilingual,
  // so both fields share the same parsing path.
  it('parses a bilingual name and description block', () => {
    const src = `levels:
  - id: x
    name:
      en: X name
      ru: Имя X
    label: "1"
    concept: linear
    description:
      en: Hello
      ru: Привет
    grid: 2x1
    start: "0 0 right"
    goal: "1 0"
    allowed: move`;
    const [level] = parseLevels(src);
    expect(level.name).toEqual({ en: 'X name', ru: 'Имя X' });
    expect(level.description).toEqual({ en: 'Hello', ru: 'Привет' });
  });

  // A level may declare only one language for either field; the app
  // falls back to en then to the label.
  it('parses single-language name and description blocks', () => {
    const src = `levels:
  - id: x
    name:
      en: Only English name
    label: "1"
    concept: linear
    description:
      en: Only English description
    grid: 2x1
    start: "0 0 right"
    goal: "1 0"
    allowed: move`;
    const [level] = parseLevels(src);
    expect(level.name).toEqual({ en: 'Only English name' });
    expect(level.description).toEqual({ en: 'Only English description' });
  });

  it('round-trips serialization back to an identical level', () => {
    const level = parseLevels(sample)[0];
    const reparsed = parseLevels(serializeLevels([level]));
    expect(reparsed).toEqual([level]);
  });

  it('round-trips the shipped LEVELS table', () => {
    expect(parseLevels(serializeLevels(LEVELS))).toEqual(LEVELS);
  });

  it('ships 7 levels from levels.data.yml with the expected ids (issue #178)', () => {
    expect(LEVELS).toHaveLength(7);
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

  it('levels.data.yml parses to exactly the shipped LEVELS', () => {
    expect(parseLevels(levelsSource)).toEqual(LEVELS);
  });

  // Issue #181: every shipped level carries a bilingual name and
  // description plus a non-empty label.
  it('gives every shipped level a bilingual name, a label, and a bilingual description', () => {
    for (const level of LEVELS) {
      expect(level.name.en?.trim(), `en name of ${level.id}`).toBeTruthy();
      expect(level.name.ru?.trim(), `ru name of ${level.id}`).toBeTruthy();
      expect(level.label.trim(), `label of ${level.id}`).not.toBe('');
      expect(
        level.description.en?.trim(),
        `en description of ${level.id}`,
      ).toBeTruthy();
      expect(
        level.description.ru?.trim(),
        `ru description of ${level.id}`,
      ).toBeTruthy();
    }
  });

  it('ignores comments and blank lines', () => {
    const messy = [
      '',
      '# header comment',
      'levels:',
      '  - id: a',
      '    name:',
      '      en: A',
      '',
      '    label: "1"',
      '    concept: linear',
      '    description:',
      '      en: A test level.',
      '',
      '    grid: 2x2',
      '    start: "0 0 up"',
      '    goal: "1 1"',
      '    allowed: move',
      '   # indented comment',
      '',
    ].join('\n');
    expect(parseLevels(messy)).toHaveLength(1);
    expect(parseLevels(messy)[0].start).toEqual({ x: 0, y: 0, dir: 0 });
  });

  it('throws a descriptive error on malformed entries', () => {
    expect(() => parseLevels('allowed: move')).toThrow(/outside of a level entry/);
    expect(() =>
      parseLevels('levels:\n  - id: x\n    concept: bad\n    grid: 1x1'),
    ).toThrow(/unknown concept/);
    expect(() =>
      parseLevels('levels:\n  - id: x\n    frobnicate: yes'),
    ).toThrow(/unknown field "frobnicate"/);
    expect(() => parseLevels('levels:\n  - id: x\n    walls: "0-0"')).toThrow(
      /expected "x,y" cell/,
    );
    expect(() => parseLevels('levels:\n  - id: x')).toThrow(/missing its name/);
    // Nested fields present but grid missing.
    expect(() =>
      parseLevels(
        'levels:\n  - id: x\n    name:\n      en: X\n    label: "1"\n    description:\n      en: d',
      ),
    ).toThrow(/missing its grid/);
    // Scalar name is the old format — rejected loudly.
    expect(() =>
      parseLevels(
        'levels:\n  - id: x\n    name: X\n    label: "1"\n    description:\n      en: d\n    grid: 1x1',
      ),
    ).toThrow(/name must use the nested form/);
    // Scalar description is the old format — rejected loudly.
    expect(() =>
      parseLevels(
        'levels:\n  - id: x\n    name:\n      en: X\n    label: "1"\n    description: d',
      ),
    ).toThrow(/description must use the nested form/);
    // Empty name block satisfies the field but not validation.
    expect(() =>
      parseLevels(
        'levels:\n  - id: x\n    name:\n    label: "1"\n    description:\n      en: d\n    grid: 1x1',
      ),
    ).toThrow(/missing its name/);
    // Empty description block satisfies the field but not validation.
    expect(() =>
      parseLevels(
        'levels:\n  - id: x\n    name:\n      en: X\n    label: "1"\n    description:\n    grid: 1x1',
      ),
    ).toThrow(/missing its description/);
    // Missing label.
    expect(() =>
      parseLevels(
        'levels:\n  - id: x\n    name:\n      en: X\n    description:\n      en: d\n    grid: 1x1',
      ),
    ).toThrow(/missing its label/);
  });

  // Issue #174: Program I/O flag is configuration data, not code.
  it('parses usesIo flags and round-trips them', () => {
    const withIo = parseLevels(
      'levels:\n  - id: io-level\n    name:\n      en: IO\n    label: "1"\n    concept: linear\n    description:\n      en: d\n    grid: 2x1\n    start: "0 0 right"\n    goal: "1 0"\n    allowed: move\n    usesIo: true',
    );
    expect(withIo[0].usesIo).toBe(true);
    expect(parseLevels(serializeLevels(withIo))).toEqual(withIo);
    const withoutIo = parseLevels(
      'levels:\n  - id: plain-level\n    name:\n      en: Plain\n    label: "1"\n    concept: linear\n    description:\n      en: d\n    grid: 2x1\n    start: "0 0 right"\n    goal: "1 0"\n    allowed: move',
    );
    expect(withoutIo[0].usesIo).toBeUndefined();
    expect(parseLevels(serializeLevels(withoutIo))).toEqual(withoutIo);
  });

  it('rejects invalid usesIo values', () => {
    const src =
      'levels:\n  - id: x\n    grid: 1x1\n    usesIo: maybe';
    expect(() => parseLevels(src)).toThrow(/usesIo/);
  });

  it('derives the shipped IO levels entirely from levels.data.yml', () => {
    const expected = new Set([
      'conditions-8',
      'arrays-22',
      'arrays-26',
      'arrays-27',
    ]);
    expect(IO_LEVEL_IDS).toEqual(expected);
    expect(levelsSource).toContain('usesIo: true');
  });
});
