import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GamePanel } from '../GamePanel';
import { lightTheme } from '../../theme';
import type { BlockData, ArrowData } from '../../canvas/types';

/**
 * Issue #142 (fix request): on a password-door level the diagram animation
 * must stop when the Input block activates and only continue after the
 * password has been submitted. GamePanel signals the pause through the
 * `onAwaitInput` callback; Canvas stops/resumes the animation loop on it.
 */

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

function makeDoorFlowchart() {
  const start = block({ type: 'start', label: 'Start' });
  const input = block({ type: 'io', label: 'Input Password' }); // #149: exact task name
  const move = block({ label: 'move' });
  const end = block({ label: 'End' });
  const arrows = [
    arrow(start.id, input.id),
    arrow(input.id, move.id),
    arrow(move.id, end.id),
  ];
  return { blocks: [start, input, move, end], arrows, input, move };
}

/** conditions-8 is the password-door level (#142): level 13 in the menu. */
function pickDoorLevel() {
  fireEvent.click(screen.getByTestId('game-level-8'));
  // Run arms the sync, exactly like the diagram animation's Run button.
  fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
}

describe('issue #142: animation stops at the input block', () => {
  it('requests an animation pause when the input block activates', () => {
    const { blocks, arrows, input } = makeDoorFlowchart();
    const onAwaitInput = vi.fn();
    const { rerender } = render(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onAwaitInput={onAwaitInput}
      />,
    );
    pickDoorLevel();
    rerender(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onAwaitInput={onAwaitInput}
        blockSignal={{ seq: 1, blockId: input.id }}
      />,
    );
    expect(onAwaitInput).toHaveBeenLastCalledWith(true);
  });

  it('releases the pause once the correct password is submitted', () => {
    const { blocks, arrows, input } = makeDoorFlowchart();
    const onAwaitInput = vi.fn();
    const { rerender } = render(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onAwaitInput={onAwaitInput}
      />,
    );
    pickDoorLevel();
    rerender(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onAwaitInput={onAwaitInput}
        blockSignal={{ seq: 1, blockId: input.id }}
      />,
    );
    fireEvent.change(screen.getByTestId('game-io-input'), {
      target: { value: '1234' },
    });
    fireEvent.keyDown(screen.getByTestId('game-io-input'), { key: 'Enter' });
    expect(onAwaitInput).toHaveBeenLastCalledWith(false);
  });

  it('does not pause on levels without a door password', () => {
    const { blocks, arrows, input } = makeDoorFlowchart();
    const onAwaitInput = vi.fn();
    const { rerender } = render(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onAwaitInput={onAwaitInput}
      />,
    );
    fireEvent.click(screen.getByTestId('game-level-1'));
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    rerender(
      <GamePanel
        language="en"
        theme={lightTheme}
        blocks={blocks}
        arrows={arrows}
        onAwaitInput={onAwaitInput}
        blockSignal={{ seq: 1, blockId: input.id }}
      />,
    );
    expect(onAwaitInput).not.toHaveBeenCalledWith(true);
  });
});
