import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Canvas } from '../Canvas';

/**
 * Issue #77: when the Russian language is selected, a block created by
 * dragging a palette item onto the canvas must get the translated default
 * label ("Действие"), not the hardcoded English one ("Action").
 */

vi.mock('react-konva', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  const makeNode =
    (name: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    forwardRef((props: any, ref: unknown) => {
      useImperativeHandle(ref as { current: unknown }, () => ({
        x: () => 0,
        y: () => 0,
        scale: () => ({ x: () => 0, y: () => 0 }),
        opacity: () => 1,
        scaleX: () => 1,
        scaleY: () => 1,
        position: () => ({ x: 0, y: 0 }),
        width: () => 0,
        height: () => 0,
        getStage: () => null,
        getAbsoluteTransform: () => ({ point: (p: unknown) => p }),
        getAbsolutePosition: () => ({ x: 0, y: 0 }),
        offset: () => ({ x: 0, y: 0 }),
        batchDraw: () => {},
        to: (cfg: { onFinish?: () => void }) => cfg?.onFinish?.(),
      }));
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

beforeEach(() => {
  localStorage.clear();
});

function dropBlockFromPalette(label: string) {
  const item = screen.getByText(label);
  fireEvent.pointerDown(item, { clientX: 300, clientY: 300 });
  fireEvent(
    window,
    new PointerEvent('pointermove', { clientX: 320, clientY: 320 }),
  );
  fireEvent(
    window,
    new PointerEvent('pointerup', { clientX: 320, clientY: 320 }),
  );
}

describe('Canvas palette-drop default label language (issue #77)', () => {
  it('creates a translated default label when dragging from the palette in Russian', () => {
    localStorage.setItem('block-diagram-language-v1', 'ru');
    render(<Canvas />);

    // Palette items are translated (already the case).
    expect(screen.getByText('Действие')).toBeInTheDocument();

    dropBlockFromPalette('Действие');

    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '{"blocks":[]}',
    );
    const labels = saved.blocks.map((b: { label: string }) => b.label);
    expect(labels).toContain('Действие');
    expect(labels).not.toContain('Action');
  });

  it('still uses the English default label when English is selected', () => {
    localStorage.setItem('block-diagram-language-v1', 'en');
    render(<Canvas />);

    dropBlockFromPalette('Action');

    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '{"blocks":[]}',
    );
    const labels = saved.blocks.map((b: { label: string }) => b.label);
    expect(labels).toContain('Action');
    expect(labels).not.toContain('Действие');
  });
});
