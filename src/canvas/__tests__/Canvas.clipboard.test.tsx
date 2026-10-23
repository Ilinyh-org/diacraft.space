import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen, within } from '@testing-library/react';
import { Canvas } from '../Canvas';
import { pasteClipboard } from '../utils/clipboard';

/**
 * Integration tests for the copy/cut/paste + selection + context-menu
 * behaviors reported on issue #42. Konva rendering is stubbed with plain
 * DOM elements whose event handlers are adapted to the Konva-style event
 * shape ({ evt, target: { getStage } }) used across the canvas code.
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

function seedBlocks(...labels: string[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      blocks: labels.map((label, i) => ({
        id: `b${i + 1}`,
        type: 'action',
        x: 100 + i * 200,
        y: 100,
        width: 120,
        height: 60,
        label,
      })),
      arrows: [],
    }),
  );
}

function key(combo: string) {
  const [mod, k] = combo.split('+');
  fireEvent.keyDown(window, {
    key: k,
    ctrlKey: mod === 'ctrl' || mod === 'cmd',
    metaKey: mod === 'cmd',
    bubbles: true,
  });
}

/**
 * The inner Group of a Block that carries the click/context-menu handlers:
 * label text -> content Group -> interactive Group.
 */
function blockNode(label: string) {
  const texts = screen.getAllByText(label);
  const text = texts[texts.length - 1];
  let el: HTMLElement | null = text;
  let groups = 0;
  while (el) {
    if (el.dataset.testid === 'group') {
      groups += 1;
      if (groups === 2) return el;
    }
    el = el.parentElement;
  }
  throw new Error(`interactive group for ${label} not found`);
}

async function renderCanvas() {
  const utils = render(<Canvas />);
  return utils;
}

beforeEach(() => {
  localStorage.clear();
  seedBlocks('Alpha', 'Beta');
});

describe('Canvas copy/cut/paste (issue #42)', () => {
  it('Ctrl+C copies the selected block and Ctrl+V pastes a duplicate', () => {
    renderCanvas();
    expect(screen.getAllByText('Alpha')).toHaveLength(1);

    fireEvent.click(blockNode('Alpha'));
    key('ctrl+c');
    key('ctrl+v');

    // Pasted block appears with fresh label rendering (2 total "Alpha").
    expect(screen.getAllByText('Alpha')).toHaveLength(2);
  });

  it('paste places the duplicate offset from the original', () => {
    renderCanvas();
    fireEvent.click(blockNode('Alpha'));
    key('ctrl+c');
    key('ctrl+v');

    // Both a pasted and original block exist; the persistence save must
    // contain exactly two blocks with distinct ids and distinct positions.
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '{"blocks":[]}',
    );
    const alphas = saved.blocks.filter(
      (b: { label: string }) => b.label === 'Alpha',
    );
    expect(alphas).toHaveLength(2);
    expect(alphas[0].id).not.toBe(alphas[1].id);
    expect(
      alphas[0].x !== alphas[1].x || alphas[0].y !== alphas[1].y,
    ).toBe(true);
  });

  it('Ctrl+X cuts the selected block and Ctrl+V pastes it back', () => {
    renderCanvas();
    fireEvent.click(blockNode('Alpha'));
    key('ctrl+x');
    expect(screen.queryByText('Alpha')).toBeNull();

    key('ctrl+v');
    expect(screen.getAllByText('Alpha')).toHaveLength(1);
  });

  it('Ctrl+click toggles a second block into a multi-selection', () => {
    renderCanvas();
    fireEvent.click(blockNode('Alpha'));
    fireEvent.click(blockNode('Beta'), { ctrlKey: true });

    key('ctrl+c');
    key('ctrl+v');

    // Both blocks were copied: duplicates of both labels appear.
    expect(screen.getAllByText('Alpha')).toHaveLength(2);
    expect(screen.getAllByText('Beta')).toHaveLength(2);
  });

  it('Ctrl+click on an already selected block deselects it', () => {
    renderCanvas();
    fireEvent.click(blockNode('Alpha'));
    fireEvent.click(blockNode('Beta'), { ctrlKey: true });
    // Toggle Beta back off; only Alpha should remain in the selection.
    fireEvent.click(blockNode('Beta'), { ctrlKey: true });

    key('ctrl+c');
    key('ctrl+v');
    expect(screen.getAllByText('Alpha')).toHaveLength(2);
    expect(screen.getAllByText('Beta')).toHaveLength(1);
  });

  it('right-clicking a block opens a context menu with Cut and Copy', () => {
    renderCanvas();
    fireEvent.contextMenu(blockNode('Alpha'), { clientX: 30, clientY: 40 });

    const menu = screen.getByTestId('context-menu');
    expect(within(menu).getByText('Cut')).toBeTruthy();
    expect(within(menu).getByText('Copy')).toBeTruthy();
  });

  it('right-clicking a block keeps an existing multi-selection', () => {
    renderCanvas();
    fireEvent.click(blockNode('Alpha'));
    fireEvent.click(blockNode('Beta'), { ctrlKey: true });
    fireEvent.contextMenu(blockNode('Beta'), { clientX: 30, clientY: 40 });

    const menu = screen.getByTestId('context-menu');
    fireEvent.click(within(menu).getByText('Copy'));
    key('ctrl+v');
    expect(screen.getAllByText('Alpha')).toHaveLength(2);
    expect(screen.getAllByText('Beta')).toHaveLength(2);
  });

  it('right-clicking empty canvas opens a context menu with Copy and Paste', () => {
    renderCanvas();
    const stage = screen.getByTestId('stage');
    fireEvent.contextMenu(stage, { clientX: 400, clientY: 300 });

    const menu = screen.getByTestId('context-menu');
    expect(within(menu).getByText('Copy')).toBeTruthy();
    expect(within(menu).getByText('Paste')).toBeTruthy();
  });

  it('right-clicking an unselected block does not change the selection', () => {
    renderCanvas();
    // Nothing is selected; right-click must not select the clicked block.
    fireEvent.contextMenu(blockNode('Alpha'), { clientX: 30, clientY: 40 });

    const menu = screen.getByTestId('context-menu');
    fireEvent.click(within(menu).getByText('Copy'));
    key('ctrl+v');

    // Clipboard was empty (no selection), so nothing was pasted.
    expect(screen.getAllByText('Alpha')).toHaveLength(1);
    expect(screen.getAllByText('Beta')).toHaveLength(1);
  });

  it('right-clicking empty canvas keeps an existing multi-selection', () => {
    renderCanvas();
    fireEvent.click(blockNode('Alpha'));
    fireEvent.click(blockNode('Beta'), { ctrlKey: true });

    fireEvent.contextMenu(screen.getByTestId('stage'), {
      clientX: 400,
      clientY: 300,
    });
    fireEvent.click(
      within(screen.getByTestId('context-menu')).getByText('Copy'),
    );
    key('ctrl+v');

    expect(screen.getAllByText('Alpha')).toHaveLength(2);
    expect(screen.getAllByText('Beta')).toHaveLength(2);
  });

  it('paste at the cursor centers one block exactly on the cursor position', () => {
    const alpha = {
      id: 'a',
      type: 'action' as const,
      x: 495,
      y: 414,
      width: 120,
      height: 60,
      label: 'Alpha',
    };
    const cursor = { x: 555, y: 444 };
    const pasted = pasteClipboard(
      { blocks: [alpha], arrows: [] },
      cursor,
    );
    expect(pasted.blocks).toHaveLength(1);
    expect(pasted.blocks[0].x + pasted.blocks[0].width / 2).toBe(cursor.x);
    expect(pasted.blocks[0].y + pasted.blocks[0].height / 2).toBe(cursor.y);
  });

  it('paste at the cursor centers the multi-selection bbox on the cursor position', () => {
    const blocks: import('../types').BlockData[] = [
      { id: 'a', type: 'action' as const, x: 0, y: 0, width: 120, height: 60, label: 'A' },
      { id: 'b', type: 'action', x: 220, y: 100, width: 120, height: 60, label: 'B' },
    ];
    const cursor = { x: 500, y: 500 };
    const pasted = pasteClipboard({ blocks, arrows: [] }, cursor);
    const minX = Math.min(...pasted.blocks.map((b) => b.x));
    const minY = Math.min(...pasted.blocks.map((b) => b.y));
    const maxX = Math.max(...pasted.blocks.map((b) => b.x + b.width));
    const maxY = Math.max(...pasted.blocks.map((b) => b.y + b.height));
    expect((minX + maxX) / 2).toBe(cursor.x);
    expect((minY + maxY) / 2).toBe(cursor.y);
  });

  it('Ctrl+V pastes centered on the last mouse position (issue #104)', () => {
    renderCanvas();
    fireEvent.click(blockNode('Alpha'));
    key('ctrl+c');

    // Move the pointer; the container rect in jsdom is empty (0x0 at 0,0),
    // so the pointer counts as beyond the canvas and the paste must land
    // at the center of the view (rect center = (0, 0) here).
    fireEvent(window, new MouseEvent('pointermove', { clientX: 400, clientY: 300 }));
    key('ctrl+v');

    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '{"blocks":[]}',
    );
    const alphas = saved.blocks.filter(
      (b: { label: string }) => b.label === 'Alpha',
    );
    expect(alphas).toHaveLength(2);
    expect(alphas[1].x + alphas[1].width / 2).toBe(0);
    expect(alphas[1].y + alphas[1].height / 2).toBe(0);
  });

  it('canvas context menu Paste inserts clipboard content', () => {
    renderCanvas();
    fireEvent.click(blockNode('Alpha'));
    key('ctrl+c');

    fireEvent.contextMenu(screen.getByTestId('stage'), {
      clientX: 400,
      clientY: 300,
    });
    fireEvent.click(
      within(screen.getByTestId('context-menu')).getByText('Paste'),
    );

    expect(screen.getAllByText('Alpha')).toHaveLength(2);
  });
});
