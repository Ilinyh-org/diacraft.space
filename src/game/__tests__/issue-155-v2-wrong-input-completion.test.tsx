import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GamePanel } from '../GamePanel';
import { lightTheme } from '../../theme';
import type { ArrowData, BlockData } from '../../canvas/types';

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
 * Issue #155 (rework): the owner reported that the level can still be
 * COMPLETED even when the input block carries the wrong name. A mismatching
 * input block must stop the run with an explicit error at the moment it
 * activates — the run may never reach the End block and count as a win.
 */
describe('issue #155 rework: wrong input block name prevents level completion', () => {
  it('stops the run with a wrong-input-name error instead of completing the level', () => {
    const { blocks, arrows } = linear('Input');
    const input = blocks[1];
    const { rerender } = render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    rerender(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        blockSignal={{ seq: 1, blockId: input.id }}
      />,
    );
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Input Password');
    expect(status.textContent).not.toContain('Level complete');
    // The input field must NOT enter password-await mode on a wrong block.
    const ioInput = screen.getByTestId('game-io-input') as HTMLInputElement;
    const awaited = 'rgb(39, 174, 96)'; // lightTheme.runHighlight #27ae60
    expect(ioInput.style.border).not.toContain(awaited);
    cleanup();
  });

  it('still waits for the password when the input block is named correctly', () => {
    const { blocks, arrows } = linear('Input Password');
    const input = blocks[1];
    const { rerender } = render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    rerender(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        blockSignal={{ seq: 1, blockId: input.id }}
      />,
    );
    const status = screen.getByRole('status');
    expect(status.textContent ?? '').not.toContain('Input Password');
    const ioInput = screen.getByTestId('game-io-input') as HTMLInputElement;
    expect(ioInput.style.border).toContain('rgb(39, 174, 96)'); // #27ae60
    cleanup();
  });
});
