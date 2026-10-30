import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { compileFlowchart, statementForBlock } from '../flowchart';
import { GamePanel } from '../GamePanel';
import { lightTheme } from '../../theme';
import type { ArrowData, BlockData } from '../../canvas/types';
import type { Level } from '../types';

let nextId = 0;
const block = (label: string, type: BlockData['type'] = 'io'): BlockData => {
  nextId += 1;
  return { id: `b${nextId}`, x: 0, y: 0, width: 120, height: 60, label, type };
};
const arrow = (fromBlockId: string, toBlockId: string): ArrowData => {
  nextId += 1;
  return {
    id: `a${nextId}`,
    fromBlockId,
    fromSide: 'bottom',
    toBlockId,
    toSide: 'top',
    waypoints: [],
    label: undefined,
  };
};

const passwordLevel: Level = {
  id: 'conditions-8',
  title: '8',
  concept: 'conditions',
  description: '',
  width: 3,
  height: 1,
  walls: [],
  doors: [[1, 0]],
  password: '1234',
  inputName: 'Input Password',
  start: { x: 0, y: 0, dir: 1 },
  goal: { x: 2, y: 0 },
  allowed: ['move', 'output', 'inputDir'],
};

const linear = (inputLabel: string): { blocks: BlockData[]; arrows: ArrowData[] } => {
  const start = block('Start', 'start');
  const input = block(inputLabel, 'io');
  const end = block('End', 'start');
  return {
    blocks: [start, input, end],
    arrows: [arrow(start.id, input.id), arrow(input.id, end.id)],
  };
};

/**
 * Issue #155: the built-in game showed the wrong hint for an I/O block.
 *
 * - The default palette block is labelled "I/O"; the compiler rejected it
 *   with "Unknown action … rename to Move, Turn left or Turn right" — the
 *   hint must instead point the user at the input block the task expects
 *   (e.g. "Input Password").
 * - Even when the input block carries another name than the task demands,
 *   the algorithm must still stop on that block and wait for the user's
 *   input — the mismatch is a hint, not a hard compile error.
 */
describe('issue #155: I/O block hint and stop-for-input behaviour', () => {
  it('compiles the default "I/O" label as an input block', () => {
    const { blocks, arrows } = linear('I/O');
    const result = compileFlowchart(blocks, arrows, 'en');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.program).toEqual([{ kind: 'inputDir' }]);
  });

  it('hints at the expected "Input Password" block name without blocking the run', () => {
    const { blocks, arrows } = linear('I/O');
    const result = compileFlowchart(blocks, arrows, 'en', {
      inputName: passwordLevel.inputName,
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toContain('Input Password');
    if (result.ok) expect(result.program).toEqual([{ kind: 'inputDir' }]);
  });

  it('still stops on an input block whose name does not match the task', () => {
    const { blocks, arrows } = linear('Input');
    const result = compileFlowchart(blocks, arrows, 'en', {
      inputName: passwordLevel.inputName,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.program).toEqual([{ kind: 'inputDir' }]);
  });

  it('statementForBlock treats any input block as an input, regardless of name', () => {
    const mismatched = block('Input', 'io');
    expect(statementForBlock(mismatched)).toEqual({ kind: 'inputDir' });
    const matching = block('Input Password', 'io');
    expect(statementForBlock(matching)).toEqual({ kind: 'inputDir' });
  });

  it('GamePanel shows the "Input Password" hint after Run and still starts the run', () => {
    const { blocks, arrows } = linear('I/O');
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    const hint = screen.getByTestId('flowchart-errors');
    expect(hint.textContent).toContain('Input Password');
    // The run is not blocked by the name mismatch: the flowchart compiles,
    // so the status line stays free of compile-error duplication (#153).
    expect(screen.queryByRole('status')?.textContent ?? '').not.toContain('Unknown action');
    cleanup();
  });
});
