import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Canvas } from '../Canvas';

/**
 * Issue #126: clicking on empty canvas space must deselect the selected
 * arrow, so that a following Delete key press does NOT delete the arrow.
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

const STORAGE_KEY = 'block-diagram-state-v1';

function seedState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      blocks: [
        {
          id: 'b1',
          type: 'action',
          x: 100,
          y: 100,
          width: 120,
          height: 60,
          label: 'Alpha',
        },
        {
          id: 'b2',
          type: 'action',
          x: 400,
          y: 100,
          width: 120,
          height: 60,
          label: 'Beta',
        },
      ],
      arrows: [
        {
          id: 'a1',
          fromBlockId: 'b1',
          fromSide: 'right',
          toBlockId: 'b2',
          toSide: 'left',
          waypoints: [],
        },
      ],
    }),
  );
}

function key(combo: string) {
  const parts = combo.split('+');
  const k = parts[parts.length - 1];
  const mod = parts.length > 1 ? parts[0] : '';
  fireEvent.keyDown(window, {
    key: k,
    ctrlKey: mod === 'ctrl' || mod === 'cmd',
    metaKey: mod === 'cmd',
    bubbles: true,
  });
}

function savedArrowCount() {
  const saved = JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? '{"arrows":[]}',
  );
  return saved.arrows.length;
}

beforeEach(() => {
  localStorage.clear();
  seedState();
});

describe('Canvas arrow deselect on empty-space click (issue #126)', () => {
  it('Delete removes the selected arrow while it stays selected', () => {
    render(<Canvas />);
    expect(savedArrowCount()).toBe(1);

    // Select the arrow via its shape.
    fireEvent.click(screen.getAllByTestId('arrow')[0]);
    key('Delete');
    expect(savedArrowCount()).toBe(0);
  });

  it('clicking empty space deselects the arrow so Delete keeps it', () => {
    render(<Canvas />);

    fireEvent.click(screen.getAllByTestId('arrow')[0]);
    // Press on the empty stage background (deselect is wired to onMouseDown).
    fireEvent.mouseDown(screen.getAllByTestId('stage')[0]);

    key('Delete');
    expect(savedArrowCount()).toBe(1);
  });
});
