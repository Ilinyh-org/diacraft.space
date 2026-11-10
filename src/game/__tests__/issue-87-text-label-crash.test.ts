import { describe, expect, it } from 'vitest';
import { compileFlowchart, isEndBlock, isStartBlock } from '../flowchart';
import type { BlockData } from '../../canvas/types';

/**
 * Issue #87: adding a text (comment) block and enabling the game menu
 * produced a blank white screen — the compiler crashed with
 * "Cannot read properties of undefined (reading 'trim')".
 *
 * Root cause: text blocks created from the palette carried an undefined
 * `label` (no `block.text` translation key existed), and the flowchart
 * compiler trimmed labels unconditionally.
 */
describe('issue #87 — text blocks with missing label must not crash the compiler', () => {
  const blockWithUndefinedLabel = (
    type: BlockData['type'],
    id: string,
  ): BlockData => ({
    id,
    x: 0,
    y: 0,
    width: 120,
    height: 60,
    label: undefined as unknown as string,
    type,
  });

  it('isEndBlock / isStartBlock tolerate an undefined label', () => {
    const note = blockWithUndefinedLabel('text', 'note');
    expect(() => isEndBlock(note)).not.toThrow();
    expect(isEndBlock(note)).toBe(false);
    expect(() => isStartBlock(note)).not.toThrow();
    expect(isStartBlock(note)).toBe(false);
  });

  it('compiles a flowchart that also contains a label-less text block', () => {
    const start: BlockData = {
      id: 'start',
      x: 0,
      y: 0,
      width: 120,
      height: 60,
      label: 'Start',
      type: 'start',
    };
    const end: BlockData = {
      id: 'end',
      x: 0,
      y: 200,
      width: 120,
      height: 60,
      label: 'End',
      type: 'start',
    };
    const note = blockWithUndefinedLabel('text', 'note');
    const result = compileFlowchart(
      [start, end, note],
      [{ id: 'a1', fromBlockId: start.id, fromSide: 'bottom', toBlockId: end.id, toSide: 'top', waypoints: [] }],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.program).toEqual([]);
    }
  });
});
