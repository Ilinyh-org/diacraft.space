import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGestureDraw, type Point } from '../useGestureDraw';

function makeContainer(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function pointer(
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  button = 0
) {
  act(() => {
    target.dispatchEvent(
      new PointerEvent(type, {
        clientX: x,
        clientY: y,
        button,
        bubbles: true,
        cancelable: true,
      })
    );
  });
}

function drawStroke(target: EventTarget, pts: [number, number][]) {
  pointer(target, 'pointerdown', pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) {
    pointer(target, 'pointermove', x, y);
  }
  pointer(window, 'pointerup', pts[pts.length - 1][0], pts[pts.length - 1][1]);
}

describe('useGestureDraw', () => {
  it('delays recognition and collects multiple strokes drawn within the window', () => {
    vi.useFakeTimers();
    const container = makeContainer();
    const onComplete = vi.fn();
    renderHook(() =>
      useGestureDraw({ current: container }, true, onComplete, 1500)
    );

    drawStroke(container, [
      [0, 0],
      [50, 0],
      [100, 0],
    ]);
    // Not recognized immediately.
    expect(onComplete).not.toHaveBeenCalled();

    drawStroke(container, [
      [25, 0],
      [25, 30],
      [25, 60],
    ]);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    const strokes = onComplete.mock.calls[0][0] as Point[][];
    expect(strokes.length).toBe(2);
    expect(strokes[0].length).toBe(3);
    expect(strokes[1].length).toBe(3);

    container.remove();
    vi.useRealTimers();
  });

  it('recognizes a single stroke after the delay elapses', () => {
    vi.useFakeTimers();
    const container = makeContainer();
    const onComplete = vi.fn();
    renderHook(() =>
      useGestureDraw({ current: container }, true, onComplete, 1500)
    );

    drawStroke(container, [
      [0, 0],
      [50, 10],
      [100, 20],
    ]);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    const strokes = onComplete.mock.calls[0][0] as Point[][];
    expect(strokes.length).toBe(1);

    container.remove();
    vi.useRealTimers();
  });

  it('ignores strokes that are too short', () => {
    vi.useFakeTimers();
    const container = makeContainer();
    const onComplete = vi.fn();
    renderHook(() =>
      useGestureDraw({ current: container }, true, onComplete, 1500)
    );

    // A tiny tap should not be counted as a stroke.
    pointer(container, 'pointerdown', 5, 5);
    pointer(window, 'pointerup', 5, 5);
    // But a real stroke after it within the window still finishes.
    drawStroke(container, [
      [0, 0],
      [50, 0],
      [100, 0],
    ]);
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    const strokes = onComplete.mock.calls[0][0] as Point[][];
    expect(strokes.length).toBe(1);

    container.remove();
    vi.useRealTimers();
  });
});
