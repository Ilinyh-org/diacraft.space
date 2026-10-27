import { describe, expect, it } from 'vitest';
import { compileFlowchart } from '../flowchart';
import { LEVELS } from '../levels';
import type { BlockData } from '../../canvas/types';

/**
 * Issue #167: the expected input-block name of the password-door level must
 * be language-aware — a player using Russian may name the block
 * «Ввод пароля», a player using English "Input Password". Both must be
 * accepted without a warning; anything else warns in the player's language.
 */

const passwordLevel = LEVELS.find((l) => l.id === 'conditions-8')!;

const block = (label: string, type: BlockData['type']): BlockData[] => [
  { id: 's', type: 'start', label: 'Start', x: 0, y: 0 } as BlockData,
  { id: 'io', type, label, x: 0, y: 1 } as BlockData,
  { id: 'e', type: 'start', label: 'End', x: 0, y: 2 } as BlockData,
];

const arrows = [
  { id: 'a1', fromBlockId: 's', toBlockId: 'io', label: '', fromSide: 'bottom', toSide: 'top' },
  { id: 'a2', fromBlockId: 'io', toBlockId: 'e', label: '', fromSide: 'bottom', toSide: 'top' },
] as unknown as Parameters<typeof compileFlowchart>[1];

describe('issue #167: localized input block names', () => {
  it('level conditions-8 declares localized input names for every language', () => {
    expect(passwordLevel.inputNames).toMatchObject({
      en: 'Input Password',
      ru: 'Ввод пароля',
    });
    expect(passwordLevel.inputName).toBe('Input Password');
  });

  it('accepts the Russian block name «Ввод пароля» without a warning', () => {
    const result = compileFlowchart(block('Ввод пароля', 'io'), arrows, 'ru', {
      inputName: passwordLevel.inputName,
      inputNames: passwordLevel.inputNames,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toEqual([]);
  });

  it('accepts the English block name "Input Password" without a warning', () => {
    const result = compileFlowchart(block('Input Password', 'io'), arrows, 'ru', {
      inputName: passwordLevel.inputName,
      inputNames: passwordLevel.inputNames,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toEqual([]);
  });

  it('warns with the Russian expected name for a wrong block name in Russian', () => {
    const result = compileFlowchart(block('Input Password1', 'io'), arrows, 'ru', {
      inputName: passwordLevel.inputName,
      inputNames: passwordLevel.inputNames,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings.join(' ')).toContain('Ввод пароля');
    }
  });

  it('warns with the English expected name for a wrong block name in English', () => {
    const result = compileFlowchart(block('Input Something', 'io'), arrows, 'en', {
      inputName: passwordLevel.inputName,
      inputNames: passwordLevel.inputNames,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(' ')).toContain('Input Password');
  });
});
