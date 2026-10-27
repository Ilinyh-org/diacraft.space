import { describe, expect, it } from 'vitest';
import type { Level } from '../types';
import { parseLevels, serializeLevels } from '../levelFormat';
import { LEVELS } from '../levels';
import levelsSource from '../levels.data.txt?raw';

describe('levelFormat (issue #169)', () => {
  const sample = `# a comment

level test-level "42" concept=loops
  grid 4x2
  start 1 1 left
  goal 3 0
  allowed move turnLeft turnRight output ifWall inputDir repeat call setInv
  description the test level
  walls 0,0 2,1
  doors 3,1
  items 1,0
  password 1234
  inputName Input Password
  inputNames en=Input Password | ru=Ввод пароля
`;

  it('parses a full level block into a Level object', () => {
    const [level] = parseLevels(sample);
    expect(level).toEqual<Level>({
      id: 'test-level',
      title: '42',
      concept: 'loops',
      description: 'the test level',
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

  it('round-trips serialization back to an identical level', () => {
    const level = parseLevels(sample)[0];
    const reparsed = parseLevels(serializeLevels([level]));
    expect(reparsed).toEqual([level]);
  });

  it('round-trips the shipped LEVELS table', () => {
    expect(parseLevels(serializeLevels(LEVELS))).toEqual(LEVELS);
  });

  it('ships 27 levels from levels.data.txt with the expected ids', () => {
    expect(LEVELS).toHaveLength(27);
    expect(LEVELS.map((l) => l.id)).toEqual([
      ...Array.from({ length: 5 }, (_, i) => `linear-${i + 1}`),
      ...Array.from({ length: 5 }, (_, i) => `conditions-${i + 6}`),
      ...Array.from({ length: 5 }, (_, i) => `loops-${i + 11}`),
      ...Array.from({ length: 5 }, (_, i) => `functions-${i + 16}`),
      ...Array.from({ length: 7 }, (_, i) => `arrays-${i + 21}`),
    ]);
  });

  it('levels.data.txt parses to exactly the shipped LEVELS', () => {
    expect(parseLevels(levelsSource)).toEqual(LEVELS);
  });

  it('ignores comments, blank lines and changed indentation', () => {
    const messy = [
      '',
      '# header comment',
      'level a "1" concept=linear',
      'grid 2x2',
      '        start 0 0 up',
      'goal 1 1',
      'allowed move',
      '   # indented comment',
      '',
    ].join('\n');
    expect(parseLevels(messy)).toHaveLength(1);
    expect(parseLevels(messy)[0].start).toEqual({ x: 0, y: 0, dir: 0 });
  });

  it('throws a descriptive error on malformed lines', () => {
    expect(() => parseLevels('allowed move')).toThrow(/outside of a level block/);
    expect(() => parseLevels('level x "x" concept=bad\ngrid 1x1')).toThrow(
      /unknown concept/,
    );
    expect(() => parseLevels('level x "x" concept=linear\nfrobnicate yes')).toThrow(
      /unknown field "frobnicate"/,
    );
    expect(() => parseLevels('level x "x" concept=linear\nwalls 0-0')).toThrow(
      /expected "x,y" cell/,
    );
    expect(() => parseLevels('level x "x" concept=linear')).toThrow(/missing its grid/);
  });

  it('refuses to serialize strings that would corrupt the format', () => {
    const bad = { ...LEVELS[0], password: 'has "quotes"' } as Level;
    expect(() => serializeLevels([bad])).toThrow(/password/);
  });
});
