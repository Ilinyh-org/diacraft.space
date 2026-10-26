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

const chart = (): { blocks: BlockData[]; arrows: ArrowData[] } => {
  const start = block('Start', 'start');
  const move1 = block('Move', 'action');
  const input = block('Input Password1', 'io');
  const move2 = block('Move', 'action');
  const end = block('End', 'start');
  return {
    blocks: [start, move1, input, move2, end],
    arrows: [
      arrow(start.id, move1.id),
      arrow(move1.id, input.id),
      arrow(input.id, move2.id),
      arrow(move2.id, end.id),
    ],
  };
};

/**
 * Issue #155 (rework 3): a wrongly named input block is only wrong FOR THE
 * LEVEL — the algorithm itself is valid. The run must proceed as usual
 * through the input block; the hint appears exactly once and nothing may
 * abort the run.
 */
describe('issue #155 rework 3: wrong input name does not stop the run', () => {
  it('lets the run proceed to End and shows the hint exactly once', () => {
    const { blocks, arrows } = chart();
    const [start, move1, input, move2, end] = blocks;
    const { rerender } = render(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    // The door needs the password typed in the Program I/O field.
    fireEvent.change(screen.getByTestId('game-io-input'), {
      target: { value: '1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    for (const [seq, b] of [start, move1, input, move2, end].entries()) {
      rerender(
        <GamePanel
          language="en"
          theme={lightTheme}
          blocks={blocks}
          arrows={arrows}
          blockSignal={{ seq: seq + 1, blockId: b.id }}
        />,
      );
    }
    // The run reaches End and gets a game result — the wrong input name did
    // not stop it with an input-name error.
    const status = screen.getByRole('status');
    // The run won — not stopped, not short of the flag.
    expect(status.textContent).toContain('Level complete');
    // The hint is shown exactly once.
    const hints = screen.getAllByTestId('flowchart-errors');
    expect(hints).toHaveLength(1);
    expect(hints[0].textContent).toContain('Input Password');
    cleanup();
  });

  it('does not use the stop message anywhere on the panel', () => {
    const { blocks, arrows } = chart();
    const input = blocks[2];
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
    expect(screen.queryByText(/stopped/i)).toBeNull();
    cleanup();
  });
});
