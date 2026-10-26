import { describe, expect, it, vi } from 'vitest';
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
 * Issue #155 (rework 2): the owner reported that (a) the wrong-input-name
 * hint appears TWICE on the panel and (b) the algorithm still runs through
 * the wrongly named input block to the End block instead of stopping.
 */
describe('issue #155 rework 2: wrong input block stops the run, hint shown once', () => {
  it('halts the diagram animation and shows the stop message exactly once', () => {
    const { blocks, arrows } = linear('Input Password1');
    const input = blocks[1];
    const onAbortDiagram = vi.fn();
    const { rerender } = render(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onAbortDiagram={onAbortDiagram}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    rerender(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onAbortDiagram={onAbortDiagram}
        blockSignal={{ seq: 1, blockId: input.id }}
      />,
    );
    // The diagram animation must be aborted at the wrong input block.
    expect(onAbortDiagram).toHaveBeenCalled();
    // The run status shows the stop message…
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Input Password');
    expect(status.textContent).toContain('stopped');
    // …and the pre-run warning hint is gone: the same text must not appear
    // twice on the panel.
    expect(screen.queryByTestId('flowchart-errors')).toBeNull();
    cleanup();
  });

  it('keeps showing the warning while the run has not reached the input block', () => {
    const { blocks, arrows } = linear('Input Password1');
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
        blockSignal={{ seq: 1, blockId: blocks[0].id }}
      />,
    );
    const hints = screen.getByTestId('flowchart-errors');
    expect(hints.textContent).toContain('Input Password');
    expect(hints.textContent).not.toContain('stopped');
    cleanup();
  });
});
