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

const chart = (): { blocks: BlockData[]; arrows: ArrowData[] } => {
  const start = block('Start', 'start');
  const move1 = block('Move', 'action');
  const end = block('End', 'start');
  return {
    blocks: [start, move1, end],
    arrows: [arrow(start.id, move1.id), arrow(move1.id, end.id)],
  };
};

/**
 * Issue #160: a Stop button next to Run in the built-in game menu. If a
 * run is stuck, the user must be able to stop it — clicking Stop stops
 * the diagram animation and resets the game state.
 */
describe('issue #160: Stop button next to Run', () => {
  it('renders a Stop button in the level view', () => {
    const { blocks, arrows } = chart();
    render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    expect(screen.getByTestId('game-stop')).toBeTruthy();
    cleanup();
  });

  it('calls the diagram stop handler and resets the run on click', () => {
    const { blocks, arrows } = chart();
    const onStopDiagram = vi.fn();
    render(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onStopDiagram={onStopDiagram}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    // The run hint area is armed by Run; Stop resets the game state.
    fireEvent.click(screen.getByTestId('game-stop'));
    expect(onStopDiagram).toHaveBeenCalledTimes(1);
    // After reset the run is disarmed: no crash/status artifacts remain,
    // and the panel is still functional (Run visible again in level view).
    expect(screen.getByRole('button', { name: '▶ Run' })).toBeTruthy();
    cleanup();
  });
});
