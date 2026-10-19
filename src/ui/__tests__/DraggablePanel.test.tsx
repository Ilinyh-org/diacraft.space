import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DraggablePanel } from '../DraggablePanel';
import { lightTheme } from '../../theme';

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
