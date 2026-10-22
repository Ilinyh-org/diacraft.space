import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Canvas } from '../Canvas';

/**
 * Regression tests for the zoom behavior reported on issue #82: after the
 * first implementation the zoom appeared completely dead on touch devices
 * because the canvas container kept the browser default `touch-action`,
 * letting the browser's native pinch-zoom swallow the two-finger gesture
 * before Konva's touch handlers could see it.
 */

vi.mock('react-konva', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  const makeNode =
    (name: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    forwardRef((props: any, ref: unknown) => {
      const current = { scaleX: 1 };
      current.scaleX = props.scaleX ?? 1;
      useImperativeHandle(ref as { current: unknown }, () => {
        const noop = () => ({ x: 0, y: 0 });
        return {
          x: () => 0,
          y: () => 0,
          scale: noop,
          opacity: () => 1,
          to: (cfg: { onFinish?: () => void }) => cfg?.onFinish?.(),
          scaleX: () => current.scaleX,
          scaleY: () => current.scaleX,
          position: () => ({ x: 0, y: 0 }),
          width: () => 0,
          height: () => 0,
          getStage: () => null,
          getPointerPosition: () => ({ x: 0, y: 0 }),
          isDragging: () => false,
          stopDrag: () => {},
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
            const ctx = {
              evt: domEvent,
              target,
              cancelBubble: false,
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (value as any)(ctx);
            if (ctx.cancelBubble) domEvent.stopPropagation();
          };
        }
      }
      return (
        <div
          data-testid={name}
          data-scale-x={String(props.scaleX ?? 1)}
          {...adapted}
        >
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

function renderCanvas() {
  return render(<Canvas />);
}

beforeEach(() => {
  localStorage.setItem(
    'block-diagram-state-v1',
    JSON.stringify({ blocks: [], arrows: [] }),
  );
});

describe('Canvas zoom gesture (issue #82 fix)', () => {
  it('disables native browser touch actions on the canvas container', () => {
    const { container } = renderCanvas();
    const stageHost = screen.getByTestId('stage').parentElement!;
    expect(stageHost.style.touchAction).toBe('none');
    void container;
  });

  it('zooms out when the wheel scrolls down and back in when it scrolls up', () => {
    renderCanvas();
    const stage = screen.getByTestId('stage');
    // Zoom out: scale prop on the Stage goes from 1 to 0.9.
    fireEvent.wheel(stage, { deltaY: 120 });
    expect(stage).toHaveAttribute('data-scale-x', '0.9');
    // Zoom back in: 0.9 * 1.1 ≈ 0.99.
    fireEvent.wheel(stage, { deltaY: -120 });
    expect(Number(stage.getAttribute('data-scale-x'))).toBeCloseTo(0.99, 10);
  });

  it('never zooms in past the default view scale', () => {
    renderCanvas();
    const stage = screen.getByTestId('stage');
    for (let i = 0; i < 10; i++) {
      fireEvent.wheel(stage, { deltaY: -120 });
    }
    expect(stage).toHaveAttribute('data-scale-x', '1');
  });
});
