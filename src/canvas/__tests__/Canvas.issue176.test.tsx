import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Canvas } from '../Canvas';

/**
 * Issue #176: the game menu must remember which page it was on. If the user
 * opened a level page, hid the game menu and showed it again, the level page
 * must be restored — not the initial levels menu.
 */

vi.mock('react-konva', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  const makeNode =
    (name: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    forwardRef((props: any, ref: unknown) => {
      useImperativeHandle(ref as { current: unknown }, () => {
        const noop = () => ({ x: 0, y: 0 });
        return {
          x: () => 0,
          y: () => 0,
          scale: noop,
          opacity: () => 1,
          to: (cfg: { onFinish?: () => void }) => cfg?.onFinish?.(),
          scaleX: () => 1,
          scaleY: () => 1,
          position: () => ({ x: 0, y: 0 }),
          width: () => 0,
          height: () => 0,
          getStage: () => null,
          getAbsoluteTransform: () => ({ point: (p: unknown) => p }),
          getAbsolutePosition: () => ({ x: 0, y: 0 }),
          offset: () => ({ x: 0, y: 0 }),
        };
      });
      const { children, ...rest } = props;
      const adapted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (key.startsWith('on') && typeof value === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          adapted[key] = (domEvent: any) => {
            const target = { getStage: () => target, x: () => 0, y: () => 0 };
            const ctx = { evt: domEvent, target, cancelBubble: false };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (value as any)(ctx);
            if (ctx.cancelBubble) domEvent.stopPropagation();
          };
        }
      }
      return (
        <div data-testid={name} {...adapted}>
          {props.text ?? children}
        </div>
      );
    });
  return {
    Stage: makeNode('stage'),
    Layer: makeNode('layer'),
    Group: makeNode('group'),
    Rect: makeNode('rect'),
    Text: makeNode('text'),
    Line: makeNode('line'),
    Ellipse: makeNode('ellipse'),
    Circle: makeNode('circle'),
    Arrow: makeNode('arrow'),
  };
});

beforeEach(() => {
  localStorage.clear();
});

function toggleGameMenu() {
  fireEvent.pointerDown(screen.getByTestId('main-menu-game'));
}

describe('Canvas game menu page persistence (issue #176)', () => {
  it('restores the level page after the game menu is hidden and reshown', () => {
    render(<Canvas />);

    // Show the game menu: it starts on the levels menu.
    toggleGameMenu();
    expect(screen.getByTestId('game-panel')).toBeTruthy();
    expect(screen.getByTestId('game-levels-menu')).toBeTruthy();

    // Pick a level: the levels menu is replaced by the level page.
    fireEvent.click(screen.getByTestId('game-level-1'));
    expect(screen.queryByTestId('game-levels-menu')).toBeNull();
    expect(screen.getByTestId('game-task')).toBeTruthy();

    // Hide the game menu...
    toggleGameMenu();
    // ...and show it again: the level page must be restored.
    toggleGameMenu();
    expect(screen.getByTestId('game-panel')).toBeTruthy();
    expect(screen.queryByTestId('game-levels-menu')).toBeNull();
    expect(screen.getByTestId('game-task')).toBeTruthy();
  });
});
