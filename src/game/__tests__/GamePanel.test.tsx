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
    // Issue #107 rework: close the levels menu to see the level content.
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    expect(screen.getByTestId('game-panel')).toBeDefined();
    expect(screen.getByText('Level 1')).toBeDefined();
    expect(screen.getByTestId('game-robot')).toBeDefined();
  });

  it('wins the first level from the canvas flowchart via the sync path (#91)', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    const { rerender } = render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    let seq = 0;
    for (const id of blocks.filter((b) => b.type !== 'start').map((b) => b.id)) {
      seq += 1;
      rerender(
        <GamePanel
          language="en"
          theme={lightTheme}
          blocks={blocks}
          arrows={arrows}
          blockSignal={{ seq, blockId: id }}
        />,
      );
    }
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
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    const robot = screen.getByTestId('game-robot') as HTMLElement;
    const ms = stepDelayMs(6);
    expect(robot.style.transition).toContain(`left ${ms}ms`);
    expect(robot.style.transition).toContain(`top ${ms}ms`);
  });

  it('uses the default animation speed when none is given', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    const robot = screen.getByTestId('game-robot') as HTMLElement;
    expect(robot.style.transition).toContain(`${stepDelayMs(5)}ms`);
  });

  it('reports a crash when the flowchart moves the robot into a wall (#91, sync path)', () => {
    const { blocks, arrows } = makeFlowchart([
      'move',
      'move',
      'move',
      'move',
      'move',
    ]);
    const { rerender } = render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    let seq = 0;
    for (const id of blocks.filter((b) => b.type !== 'start').map((b) => b.id)) {
      seq += 1;
      rerender(
        <GamePanel
          language="en"
          theme={lightTheme}
          blocks={blocks}
          arrows={arrows}
          blockSignal={{ seq, blockId: id }}
        />,
      );
    }
    expect(screen.getByRole('status').textContent).toContain('crashed');
  });

  it('does not finish instantly: game Run arms the sync like the animation Run (#91)', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    // Same behavior as the animation Run button: the game is armed and the
    // verdict only arrives as the diagram animation activates blocks.
    expect(screen.getByRole('status').textContent).not.toContain('Level complete');
    const robot = screen.getByTestId('game-robot') as HTMLElement;
    expect(robot.style.left).toBe('0px');
  });

  it('shows flowchart validation errors only after Run is clicked (#107)', () => {
    const start = block({ type: 'start', label: 'Start' });
    render(<GamePanel language="en" theme={lightTheme} blocks={[start]} arrows={[]} />);
    expect(screen.queryByTestId('flowchart-errors')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(screen.getByTestId('flowchart-errors').textContent).toContain(
      'End block',
    );
  });

  it('shows a compile error only once, not duplicated in the status line (#153)', () => {
    const start = block({ type: 'start', label: 'Start' });
    render(<GamePanel language="en" theme={lightTheme} blocks={[start]} arrows={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    const panel = screen.getByTestId('game-panel');
    const occurrences = panel.textContent?.split('End block').length ?? 1;
    // The error text appears exactly once (in the errors hint), never twice.
    expect(occurrences).toBe(2); // split yields n_occurrences + 1
  });

  it('shows the task text above the level graphics (#107)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    const task = screen.getByTestId('game-task');
    expect(task.textContent).toContain('Task:');
    expect(task.textContent).toContain('flag');
    // The task text sits above the board in DOM order.
    const panel = screen.getByTestId('game-panel');
    expect(panel.innerHTML.indexOf('game-task')).toBeLessThan(
      panel.innerHTML.indexOf('game-robot'),
    );
  });

  it('shows the levels menu exclusively: no level content while the menu is open (#107)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    // The menu is open initially and the level content is hidden.
    expect(screen.getByTestId('game-levels-menu')).toBeTruthy();
    expect(screen.queryByTestId('game-task')).toBeNull();
    expect(screen.queryByTestId('game-robot')).toBeNull();
    // Closing the menu brings the level content back.
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    expect(screen.queryByTestId('game-levels-menu')).toBeNull();
    expect(screen.getByTestId('game-task')).toBeTruthy();
    expect(screen.getByTestId('game-robot')).toBeTruthy();
  });

  it('shows neither the level line nor the Run button while the levels menu is open (#124)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    // The menu is open initially: no "Level N" header line and no Run button.
    expect(screen.getByTestId('game-levels-menu')).toBeTruthy();
    expect(screen.queryByText('Level 1')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: '▶ Run' })).toBeNull();
    // Closing the menu brings the level line and the Run button back.
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    expect(screen.getByText('Level 1')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('button', { name: '▶ Run' })).toBeTruthy();
  });

  it('does not show the run hint label (#113); the level task remains', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    const runButton = screen.getByRole('button', { name: '▶ Run' });
    expect(runButton.parentElement!.textContent).not.toContain(
      'Click run to check the flowchart',
    );
    expect(screen.getByTestId('game-task')).toBeTruthy();
  });

  it('places the Program I/O label and field on one line (#107)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    const input = screen.getByLabelText('Program I/O');
    const label = input.closest('div')!.querySelector('label');
    expect(label).not.toBeNull();
  });

  it('hides Program I/O while the levels menu is open (#117)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    expect(screen.getByTestId('game-levels-menu')).toBeTruthy();
    expect(screen.queryByLabelText('Program I/O')).toBeNull();
  });

  it('renders no redundant divider hlines in the game panel (#130)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    const { container } = render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />,
    );
    const dividers = Array.from(container.querySelectorAll('div')).filter(
      (d) => d.style.height === '1px' && d.style.background === lightTheme.divider,
    );
    expect(dividers).toHaveLength(0);
  });

  it('hides Program I/O on levels whose task has no input/output (#117)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    // Level 1 (linear-1): pure movement task — menu is open initially, so
    // the line is absent and no menu button for 16 is blocked yet.
    expect(screen.queryByLabelText('Program I/O')).toBeNull();
    // Level 16 (functions-16): functions task without I/O.
    fireEvent.click(screen.getByRole('button', { name: '16' }));
    expect(screen.queryByLabelText('Program I/O')).toBeNull();
  });

  it('shows Program I/O on levels whose task uses input/output (#117)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    // Level 8 (conditions-8): input directions task.
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(screen.getByLabelText('Program I/O')).toBeTruthy();
    // It sits after the graphical part and before the run area below it:
    // it must come before the flowchart errors / run area in DOM order.
    const robot = screen.getByTestId('game-robot');
    const io = screen.getByLabelText('Program I/O');
    expect(robot.compareDocumentPosition(io) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not show extra hints besides the task and error hint (#107)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    expect(screen.queryByText(/Build the program on the canvas/)).toBeNull();
    expect(screen.queryByText(/Directions for/)).toBeNull();
    expect(screen.queryByText(/Wall directly ahead/)).toBeNull();
  });

  it('offers every level in the levels menu, none disabled (#127, reworked by #139)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    // Issue #139: the "current level" logic is gone — every level button
    // is enabled and can be opened.
    const first = screen.getByRole('button', { name: '1' }) as HTMLButtonElement;
    expect(first.disabled).toBe(false);
    expect(first.textContent).toBe('1');
    expect(screen.getByRole('button', { name: '2' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Level 2')).toBeDefined();
    // Reopen the menu (pickLevel closes it): nothing is disabled now.
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    expect((screen.getByRole('button', { name: '2' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: '1' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('has no previous/next level buttons at the bottom (#127)', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    expect(screen.queryByTestId('game-prev-level')).toBeNull();
    expect(screen.queryByTestId('game-next-level')).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(onRunDiagram).toHaveBeenCalledTimes(1);
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
    // The levels menu is an exclusive view: close it to read the status line.
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
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

  it('renders the result message between the level view and the Run button, with the level header label in place (#132)', () => {
    const { blocks, arrows } = makeFlowchart(['move', 'move', 'move']);
    const { rerender } = render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} runSignal={1} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
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
    const statusRow = screen.getByRole('status');
    // The level header line keeps only the "Level N" label (#132).
    expect(statusRow.textContent).not.toContain('Level 1');
    const header = screen.getByText('Level 1');
    expect(header.closest('[role="status"]')).toBeNull();
    // The result message sits in its own line, right before the Run button.
    const runButton = screen.getByRole('button', { name: '▶ Run' });
    const runRow = runButton.parentElement as HTMLElement;
    expect(statusRow.nextElementSibling).toBe(runRow);
    expect(statusRow.textContent).toContain('✔ Level complete!');
    // No inline Next level button in the result line. Issue #139 restored
    // the persistent next-level switcher next to the Run button.
    expect(statusRow.querySelector('button')).toBeNull();
    expect(screen.getByTestId('game-next-level')).toBeDefined();
    // The result label is green when the level is complete.
    const winLabel = statusRow.querySelector('span') as HTMLElement;
    expect(winLabel.textContent).toContain('Level complete');
    const rgb = lightTheme.runHighlight.match(/^#(..)(..)(..)$/);
    expect(rgb).not.toBeNull();
    expect(winLabel.style.color).toBe(
      `rgb(${parseInt(rgb![1], 16)}, ${parseInt(rgb![2], 16)}, ${parseInt(rgb![3], 16)})`,
    );
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
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }));
    expect(screen.getByRole('status').textContent).toContain('crashed');
  });

  it('switches levels from the menu', () => {
    const { blocks, arrows } = makeFlowchart(['move']);
    render(<GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Level 2')).toBeDefined();
    expect(screen.getByRole('button', { name: '▶ Run' })).toBeDefined();
  });
});
