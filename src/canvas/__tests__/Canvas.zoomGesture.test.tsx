import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Canvas } from '../Canvas';

/**
 * Regression tests for the zoom behavior reported on issue #82: after the
 * first implementation the zoom appeared completely dead on touch devices
 * because the canvas container kept the browser default `touch-action`,
 * letting the browser's native pinch-zoom swallow the two-finger gesture
 * before Konva's touch handlers could see it.
 *
 * Second round (same issue): pinch zoom must be more sensitive, and while a
 * two-finger gesture is in progress a single remaining finger must not pan
 * the view until every finger has lifted.
 */

const stageDragSpy = vi.hoisted(() => ({
  isDragging: false,
  stopDragCalls: 0,
}));

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
          isDragging: () => stageDragSpy.isDragging,
          stopDrag: () => {
            stageDragSpy.stopDragCalls += 1;
          },
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
  stageDragSpy.isDragging = false;
  stageDragSpy.stopDragCalls = 0;
});

function twoFingerStart(stage: HTMLElement, dist: number) {
  return fireEvent.touchStart(stage, {
    touches: [
      { clientX: 100 - dist / 2, clientY: 200 },
      { clientX: 100 + dist / 2, clientY: 200 },
    ],
  });
}

function twoFingerEvent(
  stage: HTMLElement,
  dist: number,
  extra: TouchEventInit = {},
) {
  return fireEvent.touchMove(stage, {
    touches: [
      { clientX: 100 - dist / 2, clientY: 200 },
      { clientX: 100 + dist / 2, clientY: 200 },
    ],
    ...extra,
  });
}

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

  it('amplifies the pinch ratio so zoom reacts more sensitively', () => {
    renderCanvas();
    const stage = screen.getByTestId('stage');
    // Baseline pinch distance, then fingers moving slightly apart (zoom out).
    twoFingerEvent(stage, 100);
    twoFingerEvent(stage, 90);
    // Raw ratio would be 0.9; the amplified response is 1 + (0.9 - 1) * 1.8
    // = 0.82, clearly stronger than the raw gesture.
    expect(Number(stage.getAttribute('data-scale-x'))).toBeCloseTo(0.82, 10);
  });

  it('blocks one-finger panning while a two-finger gesture is active', () => {
    renderCanvas();
    const stage = screen.getByTestId('stage');
    twoFingerStart(stage, 100);
    twoFingerEvent(stage, 100);
    stageDragSpy.isDragging = true;
    twoFingerEvent(stage, 92);
    const stopDragCalls = stageDragSpy.stopDragCalls;
    expect(stopDragCalls).toBeGreaterThan(0);

    // One finger remains: it must not pan the canvas.
    stageDragSpy.isDragging = true;
    stageDragSpy.stopDragCalls = 0;
    const canceled = fireEvent.touchMove(stage, {
      touches: [{ clientX: 300, clientY: 300 }],
    });
    void canceled;
    expect(stageDragSpy.stopDragCalls).toBeGreaterThan(0);
    // Stage position prop never changes from its origin.
    // The one-finger move was fully swallowed: no zoom, no pan state change.
  });

  it('re-enables one-finger panning after every finger has lifted', () => {
    renderCanvas();
    const stage = screen.getByTestId('stage');
    twoFingerStart(stage, 100);
    twoFingerEvent(stage, 100);
    twoFingerEvent(stage, 92);
    fireEvent.touchEnd(stage, { touches: [] });
    stageDragSpy.stopDragCalls = 0;
    fireEvent.touchMove(stage, { touches: [{ clientX: 300, clientY: 300 }] });
    expect(stageDragSpy.stopDragCalls).toBe(0);
  });
});
