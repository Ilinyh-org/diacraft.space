import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, cleanup, type RenderResult } from '@testing-library/react';
import { DraggablePanel } from '../DraggablePanel';
import { lightTheme } from '../../theme';

/* Issue #100: the game menu must APPEAR centered on PC — it must never be
 * painted at its fallback position and then jump to the center. The panel
 * therefore has to be hidden at first paint and positioned synchronously in
 * a layout effect (before the browser paints). These tests capture the
 * panel's style at commit time, before effects run, via a child ref callback. */

const originalOffsetWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetWidth',
);
const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight',
);

function stubPanelSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      if (this.classList?.contains('draggable-panel')) return width;
      return 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      if (this.classList?.contains('draggable-panel')) return height;
      return 0;
    },
  });
}

/** Records the panel's inline style at commit time (before effects). */
function Probe({ onLoad }: { onLoad: (style: Record<string, string>) => void }) {
  return (
    <div
      ref={(node) => {
        if (!node) return;
        const panel = node.closest('.draggable-panel') as HTMLElement | null;
        if (panel) {
          // Snapshot the values: CSSStyleDeclaration is a live object.
          onLoad({
            visibility: panel.style.visibility,
            left: panel.style.left,
            top: panel.style.top,
          });
        }
      }}
    >
      probe
    </div>
  );
}

function renderPanel(onLoad: (style: Record<string, string>) => void): RenderResult {
  return render(
    <DraggablePanel
      theme={lightTheme}
      initialPosition={{ x: 700, y: 10 }}
      center
      storageKey="test-issue-100"
    >
      <Probe onLoad={onLoad} />
    </DraggablePanel>,
  );
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
});

afterEach(() => {
  if (originalOffsetWidth) {
    Object.defineProperty(
      HTMLElement.prototype,
      'offsetWidth',
      originalOffsetWidth,
    );
  }
  if (originalOffsetHeight) {
    Object.defineProperty(
      HTMLElement.prototype,
      'offsetHeight',
      originalOffsetHeight,
    );
  }
});

describe('issue #100: menu appears centered on first paint', () => {
  it('is hidden at commit time so the fallback position is never visible', () => {
    stubPanelSize(200, 100);
    let commitStyle: Record<string, string> | undefined;

    renderPanel((s) => {
      commitStyle = s;
    });
    expect(commitStyle).toBeDefined();
    // At first paint the panel must not be visible at the fallback position.
    expect(commitStyle!.visibility).toBe('hidden');
  });

  it('is placed at the window center before the first paint', () => {
    stubPanelSize(200, 100);
    let commitStyle: Record<string, string> | undefined;
    const view = renderPanel((s) => {
      commitStyle = s;
    });
    const panel = view.container.querySelector(
      '.draggable-panel',
    ) as HTMLElement;
    // After effects flush (still before the browser paints) the panel sits centered.
    const expectedLeft = Math.round((window.innerWidth - 200) / 2);
    const expectedTop = Math.round((window.innerHeight - 100) / 2);
    expect(panel.style.left).toBe(`${expectedLeft}px`);
    expect(panel.style.top).toBe(`${expectedTop}px`);
    // ...and becomes visible only once placed.
    expect(panel.style.visibility).toBe('visible');
    // The commit-time snapshot was still hidden: no fallback flash.
    expect(commitStyle!.visibility).toBe('hidden');
  });

  it('remembers a dragged position without flashing hidden afterwards', () => {
    stubPanelSize(200, 100);
    window.localStorage.setItem(
      'test-issue-100',
      JSON.stringify({ x: 50, y: 60 }),
    );
    const view = renderPanel(() => {});
    const panel = view.container.querySelector(
      '.draggable-panel',
    ) as HTMLElement;
    expect(panel.style.left).toBe('50px');
    expect(panel.style.top).toBe('60px');
    expect(panel.style.visibility).toBe('visible');
  });
});
