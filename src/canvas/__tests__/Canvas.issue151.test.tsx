import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Canvas } from '../Canvas';

/**
 * Issue #151: dropping a block while an animated alignment guide is visible
 * must snap the block onto the guide. The guide appears during dragMove;
 * the drop position is a few px off the guide and the final state must be
 * exactly aligned.
 */

// Shared "Konva node" position controlled by the test.
const dragPos = { x: 0, y: 0 };

// Captured Konva event handlers with their props, so tests can pick the
// right node (the draggable block group) among many groups.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlerRegistry: { name: string; key: string; props: any; invoke: (ctx: unknown) => void }[] = [];

vi.mock('react-konva', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  const makeNode =
    (name: string, isDraggableGroup: boolean) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    forwardRef((props: any, ref: unknown) => {
      useImperativeHandle(ref as { current: unknown }, () => {
        const noop = () => ({ x: 0, y: 0 });
        return {
          x: () => (isDraggableGroup ? dragPos.x : 0),
          y: () => (isDraggableGroup ? dragPos.y : 0),
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
          dashOffset: () => 0,
          getLayer: () => null,
          dash: () => [],
        };
      });
      const { children, ...rest } = props;
      const adapted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (key.startsWith('on') && typeof value === 'function') {
          // Map Konva drag lifecycle handlers onto DOM events so tests can
          // fireEvent them; the fake event target reports dragPos.
          const domKey =
            isDraggableGroup && key === 'onDragMove'
              ? 'onMouseMove'
              : isDraggableGroup && key === 'onDragEnd'
                ? 'onMouseUp'
                : isDraggableGroup && key === 'onDragStart'
                  ? 'onMouseDown'
                  : key;
          const invoke = (domEvent: unknown) => {
            const target = {
              getStage: () => null,
              x: () => dragPos.x,
              y: () => dragPos.y,
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (value as any)({
              evt: domEvent,
              target,
              cancelBubble: false,
            });
          };
          adapted[domKey] = invoke;
          handlerRegistry.push({ name, key, props: rest, invoke });
        }
      }
      return (
        <div data-testid={name} {...adapted}>
          {props.text ?? children}
        </div>
      );
    });
  return {
    Stage: makeNode('stage', false),
    Layer: makeNode('layer', false),
    Group: makeNode('group', true),
    Rect: makeNode('rect', false),
    Text: makeNode('text', false),
    Line: makeNode('line', false),
    Ellipse: makeNode('ellipse', false),
    Circle: makeNode('circle', false),
    Arrow: makeNode('arrow', false),
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
          y: 300,
          width: 120,
          height: 60,
          label: 'Beta',
        },
      ],
      arrows: [],
    }),
  );
}

function savedBlock(id: string) {
  const saved = JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? '{"blocks":[]}',
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (saved.blocks as any[]).find((b) => b.id === id);
}

beforeEach(() => {
  localStorage.clear();
  seedState();
  dragPos.x = 0;
  dragPos.y = 0;
});

describe('Canvas drop alignment snap (issue #151)', () => {
  it('snaps the dropped block onto the visible alignment guide', () => {
    render(<Canvas />);

    // b1 center: (160, 130). Drag b2 near that center x but not exact.
    dragPos.x = 106; // center x = 166 → |160-166| = 6 ≤ tolerance 8
    dragPos.y = 300;
    // The draggable block group is the one with the double-click label edit
    // handler (resize-handle groups never have onDblClick).
    const blockGroups = handlerRegistry.filter(
      (h) =>
        h.name === 'group' &&
        h.key === 'onDragMove' &&
        h.props.draggable === true &&
        typeof h.props.onTap === 'function',
    );
    // The LAST such group is b2 (blocks render in array order).
    // eslint-disable-next-line no-console
    const target = blockGroups[blockGroups.length - 1];
    expect(target).toBeDefined();
    // Fire dragStart: in the app EVERY block drag goes through the
    // multi-drag path (dragStart captures at least the dragged block).
    const startEntry = handlerRegistry
      .filter(
        (h) =>
          h.name === 'group' &&
          h.key === 'onDragStart' &&
          h.props.draggable === true &&
          typeof h.props.onTap === 'function',
      )
      .pop();
    expect(startEntry).toBeDefined();
    act(() => startEntry!.invoke({}));
    act(() => target.invoke({}));

    // Release slightly off alignment: center x = 168 (8 off, still aligned).
    dragPos.x = 108;
    dragPos.y = 302;
    const endEntry = handlerRegistry
      .filter(
        (h) =>
          h.name === 'group' &&
          h.key === 'onDragEnd' &&
          h.props.draggable === true &&
          typeof h.props.onTap === 'function',
      )
      .pop();
    act(() => endEntry!.invoke({}));

    // The block must be snapped so its center x is exactly 160.
    const b2 = savedBlock('b2');
    expect(b2.x).toBe(100);
  });
});
