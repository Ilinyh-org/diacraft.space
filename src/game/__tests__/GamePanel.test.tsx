import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GamePanel } from '../GamePanel';
import { lightTheme } from '../../theme';
import type { BlockData, ArrowData } from '../../canvas/types';

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
});

let nextId = 0;

function block(overrides: Partial<BlockData> = {}): BlockData {
  nextId += 1;
  return {
    id: `b${nextId}`,
    x: 0,
    y: 0,
    width: 120,
    height: 60,
    label: 'Action',
    type: 'action',
    ...overrides,
  };
}

function arrow(fromBlockId: string, toBlockId: string): ArrowData {
  nextId += 1;
  return {
    id: `a${nextId}`,
    fromBlockId,
    fromSide: 'bottom',
    toBlockId,
    toSide: 'top',
    waypoints: [],
  };
}

function makeFlowchart(labels: string[]) {
  const start = block({ type: 'start', label: 'Start' });
  const blocks = [start];
  const arrows: ArrowData[] = [];
  for (const label of labels) {
    const b = block({ label });
    blocks.push(b);
    arrows.push(arrow(blocks[blocks.length - 2].id, b.id));
  }
  const end = block({ label: 'End' });
  arrows.push(arrow(blocks[blocks.length - 1].id, end.id));
  blocks.push(end);
  return { blocks, arrows };
}

describe('GamePanel', () => {
  it('renders the level board of the first level', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel theme={lightTheme} blocks={blocks} arrows={arrows} />);
    expect(screen.getByTestId('game-panel')).toBeDefined();
    expect(screen.getByText('First steps')).toBeDefined();
    expect(screen.getByTestId('game-robot')).toBeDefined();
  });

  it('shows the compiled program from the canvas flowchart', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    render(<GamePanel theme={lightTheme} blocks={blocks} arrows={arrows} />);
    expect(screen.getByTestId('flowchart-program').textContent).toContain(
      'Move',
    );
    expect(screen.getByText('Commands: 3')).toBeDefined();
  });

  it('wins the first level from the canvas flowchart', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    render(<GamePanel theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(screen.getByRole('status').textContent).toContain('Level complete');
  });

  it('reports a crash when the flowchart moves the robot into a wall', () => {
    const { blocks, arrows } = makeFlowchart([
      'move',
      'move',
      'move',
      'move',
      'move',
    ]);
    render(<GamePanel theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(screen.getByRole('status').textContent).toContain('crashed');
  });

  it('shows flowchart validation errors and refuses to run', () => {
    const start = block({ type: 'start', label: 'Start' });
    render(<GamePanel theme={lightTheme} blocks={[start]} arrows={[]} />);
    expect(screen.getByTestId('flowchart-errors').textContent).toContain(
      'End block',
    );
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(screen.getByRole('status').textContent).toContain('✖');
  });

  it('starts the diagram animation when Run is clicked from the button', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    const onRunDiagram = vi.fn();
    render(
      <GamePanel
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onRunDiagram={onRunDiagram}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(onRunDiagram).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain('Level complete');
  });

  it('does not trigger the diagram animation on a run signal', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    const onRunDiagram = vi.fn();
    const { rerender } = render(
      <GamePanel
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onRunDiagram={onRunDiagram}
      />,
    );
    rerender(
      <GamePanel
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        runSignal={1}
        onRunDiagram={onRunDiagram}
      />,
    );
    expect(onRunDiagram).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Level complete');
  });

  it('runs the game when the run signal changes', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    const { rerender } = render(
      <GamePanel theme={lightTheme} blocks={blocks} arrows={arrows} />,
    );
    rerender(
      <GamePanel theme={lightTheme} blocks={blocks} arrows={arrows} runSignal={1} />,
    );
    expect(screen.getByRole('status').textContent).toContain('Level complete');
  });

  it('switches levels from the menu', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: /The corner/ }));
    expect(screen.getByText('The corner')).toBeDefined();
    expect(screen.getByRole('button', { name: '▶ Run' })).toBeDefined();
  });
});
