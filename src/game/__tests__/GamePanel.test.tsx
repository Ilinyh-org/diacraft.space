import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { GamePanel } from '../GamePanel';
import { lightTheme } from '../../theme';
import { stepDelayMs } from '../../canvas/ui/AlgorithmPanel';
import type { BlockData, ArrowData } from '../../canvas/types';

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
});

let nextId = 0;

const lastSeqRef = { value: 1 };

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
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    expect(screen.getByTestId('game-panel')).toBeDefined();
    expect(screen.getByText('First steps')).toBeDefined();
    expect(screen.getByTestId('game-robot')).toBeDefined();
  });

  it('wins the first level from the canvas flowchart', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(screen.getByRole('status').textContent).toContain('Level complete');
  });

  it('moves the robot with a transition that matches the animation speed', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        speed={6}
      />,
    );
    const robot = screen.getByTestId('game-robot') as HTMLElement;
    const ms = stepDelayMs(6);
    expect(robot.style.transition).toContain(`left ${ms}ms`);
    expect(robot.style.transition).toContain(`top ${ms}ms`);
  });

  it('uses the default animation speed when none is given', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    const robot = screen.getByTestId('game-robot') as HTMLElement;
    expect(robot.style.transition).toContain(`${stepDelayMs(3)}ms`);
  });

  it('reports a crash when the flowchart moves the robot into a wall', () => {
    const { blocks, arrows } = makeFlowchart([
      'move',
      'move',
      'move',
      'move',
      'move',
    ]);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(screen.getByRole('status').textContent).toContain('crashed');
  });

  it('shows flowchart validation errors and refuses to run', () => {
    const start = block({ type: 'start', label: 'Start' });
    render(<GamePanel language="en" theme={lightTheme} blocks={[start]} arrows={[]} />);
    expect(screen.getByTestId('flowchart-errors').textContent).toContain(
      'End block',
    );
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(screen.getByRole('status').textContent).toContain('✖');
  });

  it('does not show build hints before Run is clicked (#49)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    expect(screen.queryByText(/Build the program on the canvas/)).toBeNull();
  });

  it('shows build hints only after Run is clicked (#49)', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(screen.getByText(/Build the program on the canvas/)).toBeDefined();
  });

  it('does not duplicate the program or the command count (#49)', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    expect(screen.queryByTestId('flowchart-program')).toBeNull();
    expect(screen.queryByText(/Commands:/)).toBeNull();
    expect(screen.queryByText(/Program:/)).toBeNull();
  });

  it('keeps the game text selectable (#49)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    const panel = screen.getByTestId('game-panel') as HTMLElement;
    expect(panel.style.userSelect).not.toBe('none');
  });

  it('starts the diagram animation when Run is clicked from the button', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    const onRunDiagram = vi.fn();
    render(
      <GamePanel
        language="en"
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
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onRunDiagram={onRunDiagram}
      />,
    );
    rerender(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        runSignal={1}
        onRunDiagram={onRunDiagram}
      />,
    );
    expect(onRunDiagram).not.toHaveBeenCalled();
    // The game is armed but not finished: it now advances in sync with the
    // diagram animation instead of running the whole program at once.
    expect(screen.getByRole('status').textContent).not.toContain(
      'Level complete',
    );
  });

  it('advances the robot one statement per activated block and wins at End (#40)', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    const { rerender } = render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} runSignal={1} />,
    );
    const robotBefore = screen.getByTestId('game-robot');
    const leftBefore = (robotBefore as HTMLElement).style.left;
    for (const id of blocks.filter((b) => b.type !== 'start').map((b) => b.id)) {
      rerender(
        <GamePanel
        language="en"
          theme={lightTheme}
          blocks={blocks}
          arrows={arrows}
          runSignal={1}
          blockSignal={{ seq: lastSeqRef.value, blockId: id }}
        />,
      );
      lastSeqRef.value += 1;
    }
    expect(screen.getByRole('status').textContent).toContain('Level complete');
    const robotAfter = screen.getByTestId('game-robot');
    expect((robotAfter as HTMLElement).style.left).not.toBe(leftBefore);
  });

  it('highlights the game panel when the algorithm finishes successfully (#40)', () => {
    vi.useFakeTimers();
    try {
      const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
      const { rerender } = render(
        <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} runSignal={1} />,
      );
      let seq = 0;
      for (const id of blocks.filter((b) => b.type !== 'start').map((b) => b.id)) {
        seq += 1;
        rerender(
          <GamePanel
        language="en"
            theme={lightTheme}
            blocks={blocks}
            arrows={arrows}
            runSignal={1}
            blockSignal={{ seq, blockId: id }}
          />,
        );
      }
      const panel = screen.getByTestId('game-panel') as HTMLElement;
      expect(panel.style.border).toContain('rgb(39, 174, 96)');
      act(() => {
        vi.advanceTimersByTime(3100);
      });
      expect((screen.getByTestId('game-panel') as HTMLElement).style.border).toContain(
        '2px solid transparent',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a crash when a synchronized move hits a wall (#40)', () => {
    const { blocks, arrows } = makeFlowchart([
      'move',
      'move',
      'move',
      'move',
      'move',
    ]);
    const { rerender } = render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} runSignal={1} />,
    );
    let seq = 0;
    for (const id of blocks.filter((b) => b.type !== 'start').map((b) => b.id)) {
      seq += 1;
      rerender(
        <GamePanel
        language="en"
          theme={lightTheme}
          blocks={blocks}
          arrows={arrows}
          runSignal={1}
          blockSignal={{ seq, blockId: id }}
        />,
      );
    }
    expect(screen.getByRole('status').textContent).toContain('crashed');
  });

  it('switches levels from the menu', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: /The corner/ }));
    expect(screen.getByText('The corner')).toBeDefined();
    expect(screen.getByRole('button', { name: '▶ Run' })).toBeDefined();
  });
});
