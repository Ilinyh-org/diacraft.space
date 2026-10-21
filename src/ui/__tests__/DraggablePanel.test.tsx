import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DraggablePanel, moveWithCollision } from '../DraggablePanel';
import { lightTheme } from '../../theme';

const rect = (left: number, top: number, w: number, h: number) => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
});

describe('moveWithCollision', () => {
  const win = { width: 800, height: 600 };
  const size = { width: 100, height: 50 };

  it('allows free movement when there are no obstacles', () => {
    expect(
      moveWithCollision({ x: 0, y: 0 }, { x: 200, y: 150 }, size, [], win),
    ).toEqual({ x: 200, y: 150 });
  });

  it('blocks movement into an obstacle and stops exactly at its boundary', () => {
    const obstacles = [rect(50, 100, 200, 100)];
    expect(
      moveWithCollision({ x: 60, y: 0 }, { x: 60, y: 120 }, size, obstacles, win),
    ).toEqual({ x: 60, y: 50 });
  });

  it('stops at the obstacle boundary on a diagonal move, keeping horizontal movement', () => {
    const obstacles = [rect(150, 100, 200, 200)];
    // Full move overlaps; the panel stops just above the obstacle's top edge.
    expect(
      moveWithCollision({ x: 100, y: 0 }, { x: 160, y: 120 }, size, obstacles, win),
    ).toEqual({ x: 160, y: 50 });
  });

  it('slides horizontally and stops at the obstacle edge when moving right into it', () => {
    const obstacles = [rect(250, 0, 200, 200)];
    expect(
      moveWithCollision({ x: 100, y: 100 }, { x: 300, y: 150 }, size, obstacles, win),
    ).toEqual({ x: 150, y: 150 });
  });

  it('stops at the obstacle boundary when moving straight into it', () => {
    const obstacles = [rect(250, 0, 200, 200)];
    expect(
      moveWithCollision({ x: 100, y: 0 }, { x: 300, y: 0 }, size, obstacles, win),
    ).toEqual({ x: 150, y: 0 });
  });

  it('window clamping never pushes the panel into an obstacle at the edge', () => {
    const smallWin = { width: 500, height: 500 };
    const obstacles = [rect(420, 100, 200, 100)];
    const result = moveWithCollision(
      { x: 300, y: 0 },
      { x: 460, y: 120 },
      size,
      obstacles,
      smallWin,
    );
    const overlaps =
      result.x < obstacles[0].right &&
      result.x + size.width > obstacles[0].left &&
      result.y < obstacles[0].bottom &&
      result.y + size.height > obstacles[0].top;
    expect(overlaps).toBe(false);
  });

  it('returns the previous position when fully boxed in', () => {
    const obstacles = [
      rect(100, 50, 100, 50),
      rect(100, 150, 100, 50),
      rect(0, 100, 100, 50),
      rect(200, 100, 100, 50),
    ];
    expect(
      moveWithCollision({ x: 100, y: 100 }, { x: 140, y: 120 }, size, obstacles, win),
    ).toEqual({ x: 100, y: 100 });
  });

  it('resolves against multiple obstacles in one move', () => {
    const obstacles = [rect(150, 100, 200, 200), rect(150, 300, 200, 200)];
    expect(
      moveWithCollision({ x: 100, y: 0 }, { x: 160, y: 250 }, size, obstacles, win),
    ).toEqual({ x: 160, y: 50 });
  });
});

describe('DraggablePanel', () => {
  it('renders children at the initial position', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 20, y: 30 }}>
        <div>content</div>
      </DraggablePanel>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
    const panel = screen.getByText('content').parentElement!.parentElement!;
    expect(panel.style.left).toBe('20px');
    expect(panel.style.top).toBe('30px');
  });

  it('moves the panel when the handle is dragged', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 0, y: 0 }}>
        <div>content</div>
      </DraggablePanel>,
    );
    const handle = screen.getByText('content').parentElement!.parentElement!
      .firstElementChild!;
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 60, clientY: 40 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    const panel = screen.getByText('content').parentElement!.parentElement!;
    expect(panel.style.left).toBe('50px');
    expect(panel.style.top).toBe('30px');
  });

  it('stops dragging on pointer up so later moves have no effect', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 0, y: 0 }}>
        <div>content</div>
      </DraggablePanel>,
    );
    const handle = screen.getByText('content').parentElement!.parentElement!
      .firstElementChild!;
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 100 });

    const panel = screen.getByText('content').parentElement!.parentElement!;
    expect(panel.style.left).toBe('0px');
    expect(panel.style.top).toBe('0px');
  });

  it('cannot be dragged into another panel (pushes out along the shallower axis)', () => {
    const rects = new Map<HTMLElement, DOMRect>();
    const original = HTMLElement.prototype.getBoundingClientRect;
    // Measure obstacle via getBoundingClientRect; dragged panel via offsetWidth/Height.
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return rects.has(this) ? 100 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        return rects.has(this) ? 50 : 0;
      },
    });
    HTMLElement.prototype.getBoundingClientRect = function () {
      return (
        rects.get(this) ??
        new DOMRect(0, 0, 0, 0)
      );
    };

    try {
      const { unmount: unmountObstacle } = render(
        <div
          data-testid="obstacle"
          className="draggable-panel"
          style={{ position: 'absolute', left: 100, top: 100, width: 100, height: 100 }}
        >
          obstacle
        </div>,
      );
      const obstacle = screen.getByTestId('obstacle');
      rects.set(obstacle, new DOMRect(100, 100, 100, 100));

      render(
        <DraggablePanel theme={lightTheme} initialPosition={{ x: 100, y: 0 }}>
          <div>content</div>
        </DraggablePanel>,
      );
      const panel = screen.getByText('content').parentElement!.parentElement!;
      rects.set(panel, new DOMRect(100, 0, 100, 50));
      const handle = panel.firstElementChild!;

      // Drag straight down into the obstacle: would land at (100, 80).
      fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: 0, clientY: 80 });
      fireEvent.pointerUp(handle, { pointerId: 1 });

      const left = parseFloat(panel.style.left);
      const top = parseFloat(panel.style.top);
      // Pushed back up so its bottom edge just touches the obstacle's top edge.
      expect(left).toBe(100);
      expect(top).toBe(50);
      unmountObstacle();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          return 0;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        configurable: true,
        get() {
          return 0;
        },
      });
    }
  });
});
