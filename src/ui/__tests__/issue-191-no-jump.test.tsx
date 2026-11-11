import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DraggablePanel } from '../DraggablePanel';
import { lightTheme } from '../../theme';

/**
 * Issue #191: when a drag is blocked by a collision constraint, the panel
 * must stay at its last valid position instead of jumping to a recalculated
 * (slid/snapped) position.
 */
describe('issue #191: no jumping when movement is blocked', () => {
  it('keeps the panel at its previous position when a move is blocked', () => {
    const rects = new Map<HTMLElement, DOMRect>();
    const original = HTMLElement.prototype.getBoundingClientRect;
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
      return rects.get(this) ?? new DOMRect(0, 0, 0, 0);
    };

    try {
      const { unmount: unmountObstacle } = render(
        <div
          data-testid="obstacle"
          className="draggable-panel"
          style={{ position: 'absolute', left: 100, top: 40, width: 100, height: 100 }}
        >
          obstacle
        </div>,
      );
      const obstacle = screen.getByTestId('obstacle');
      rects.set(obstacle, new DOMRect(100, 40, 100, 100));

      render(
        <DraggablePanel theme={lightTheme} initialPosition={{ x: 100, y: 0 }}>
          <div>content</div>
        </DraggablePanel>,
      );
      const panel = screen.getByText('content').parentElement!.parentElement!;
      rects.set(panel, new DOMRect(100, 0, 100, 50));
      const handle = panel.firstElementChild!;

      // Blocked move straight down into the obstacle: stay at the last valid
      // position instead of jumping to a recalculated one.
      fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: 0, clientY: 60 });
      fireEvent.pointerUp(handle, { pointerId: 1 });
      expect(panel.style.left).toBe('100px');
      expect(panel.style.top).toBe('0px');

      // Blocked diagonal move into the obstacle: still no jump.
      fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: 40, clientY: 60 });
      fireEvent.pointerUp(handle, { pointerId: 1 });
      expect(panel.style.left).toBe('100px');
      expect(panel.style.top).toBe('0px');

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

  it('keeps the last valid mid-drag position when a later move is blocked', () => {
    const rects = new Map<HTMLElement, DOMRect>();
    const original = HTMLElement.prototype.getBoundingClientRect;
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
      return rects.get(this) ?? new DOMRect(0, 0, 0, 0);
    };

    try {
      render(
        <DraggablePanel theme={lightTheme} initialPosition={{ x: 100, y: 0 }}>
          <div>content2</div>
        </DraggablePanel>,
      );
      const panel = screen.getByText('content2').parentElement!.parentElement!;
      rects.set(panel, new DOMRect(100, 0, 100, 50));
      const handle = panel.firstElementChild!;

      fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
      // First a valid move to the right edge of the window (x = 920 = max).
      fireEvent.pointerMove(handle, { clientX: 820, clientY: 0 });
      expect(panel.style.left).toBe('920px');

      // Now a further move to the right is blocked by the window bounds:
      // the panel must stay at the last valid mid-drag position, not snap
      // back to where the drag started.
      fireEvent.pointerMove(handle, { clientX: 900, clientY: 0 });
      expect(panel.style.left).toBe('920px');
      expect(panel.style.top).toBe('0px');

      fireEvent.pointerUp(handle, { pointerId: 1 });
      expect(panel.style.left).toBe('920px');
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
