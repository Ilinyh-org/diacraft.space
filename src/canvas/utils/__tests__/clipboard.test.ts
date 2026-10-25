import { describe, it, expect } from 'vitest';
import {
  copySelection,
  clipboardBBox,
  pasteClipboard,
  keyboardPasteTarget,
} from '../clipboard';
import type { BlockData, ArrowData } from '../../types';

function block(id: string, x = 0, y = 0): BlockData {
  return {
    id,
    x,
    y,
    width: 100,
    height: 50,
    label: id,
    type: 'action',
  };
}

function arrow(
  id: string,
  fromBlockId: string,
  toBlockId: string
): ArrowData {
  return {
    id,
    fromBlockId,
    fromSide: 'bottom',
    toBlockId,
    toSide: 'top',
    waypoints: [{ x: 10, y: 20 }],
  };
}

describe('copySelection', () => {
  it('copies only selected blocks', () => {
    const blocks = [block('a'), block('b'), block('c')];
    const clip = copySelection(blocks, [], ['a', 'c']);
    expect(clip.blocks.map((b) => b.id)).toEqual(['a', 'c']);
    expect(clip.arrows).toEqual([]);
  });

  it('keeps arrows whose both endpoints are selected', () => {
    const blocks = [block('a'), block('b'), block('c')];
    const arrows = [arrow('x', 'a', 'b'), arrow('y', 'a', 'c')];
    const clip = copySelection(blocks, arrows, ['a', 'b']);
    expect(clip.arrows.map((a) => a.id)).toEqual(['x']);
  });

  it('includes explicitly selected arrows and their endpoint blocks (issue #133)', () => {
    const blocks = [block('a'), block('b'), block('c')];
    const arrows = [arrow('x', 'a', 'b'), arrow('y', 'a', 'c')];
    const clip = copySelection(blocks, arrows, ['b'], ['y']);
    // Endpoint blocks a and c are pulled in so the pasted arrow stays valid.
    expect(clip.blocks.map((b) => b.id)).toEqual(['a', 'b', 'c']);
    // y is explicitly selected; x also runs between copied blocks a–b.
    expect(clip.arrows.map((a) => a.id)).toEqual(['x', 'y']);
  });

  it('copies selected arrows even with no explicitly selected blocks (issue #133)', () => {
    const blocks = [block('a'), block('b')];
    const arrows = [arrow('x', 'a', 'b')];
    const clip = copySelection(blocks, arrows, [], ['x']);
    expect(clip.blocks.map((b) => b.id)).toEqual(['a', 'b']);
    expect(clip.arrows.map((a) => a.id)).toEqual(['x']);
  });
});

describe('clipboardBBox', () => {
  it('returns null for an empty clipboard', () => {
    expect(clipboardBBox({ blocks: [], arrows: [] })).toBeNull();
  });

  it('computes the bounding box', () => {
    const clip = { blocks: [block('a', 0, 0), block('b', 150, 80)], arrows: [] };
    expect(clipboardBBox(clip)).toEqual({
      x: 0,
      y: 0,
      width: 250,
      height: 130,
    });
  });
});

describe('pasteClipboard', () => {
  it('pastes with fresh ids and preserves relative layout', () => {
    const blocks = [block('a', 0, 0), block('b', 150, 80)];
    const arrows = [arrow('x', 'a', 'b')];
    const { blocks: nb, arrows: na } = pasteClipboard({ blocks, arrows });

    expect(nb).toHaveLength(2);
    expect(nb[0].id).not.toBe('a');
    expect(nb[1].id).not.toBe('b');
    expect(nb[1].x - nb[0].x).toBe(150);
    expect(nb[1].y - nb[0].y).toBe(80);
    expect(na).toHaveLength(1);
    expect(na[0].id).not.toBe('x');
    expect(na[0].fromBlockId).toBe(nb[0].id);
    expect(na[0].toBlockId).toBe(nb[1].id);
  });

  it('drops arrows whose endpoints were not copied', () => {
    const blocks = [block('a'), block('b')];
    const arrows = [arrow('x', 'a', 'b')];
    const clip = copySelection(blocks, arrows, ['a']);
    const { arrows: na } = pasteClipboard(clip);
    expect(na).toHaveLength(0);
  });

  it('centers pasted content on the given cursor point', () => {
    const clip = { blocks: [block('a', 0, 0), block('b', 100, 0)], arrows: [] };
    const { blocks: nb } = pasteClipboard(clip, { x: 200, y: 100 });
    // bbox: x 0..200, width 200; left edge must land at 200 - 100 = 100.
    expect(nb[0].x).toBe(100);
    expect(nb[1].x).toBe(200);
    // bbox height 50, centered on y=100 => top at 75.
    expect(nb[0].y).toBe(75);
  });

  it('offsets pasted content below-right of the original when no cursor', () => {
    const clip = { blocks: [block('a', 0, 0)], arrows: [] };
    const { blocks: nb } = pasteClipboard(clip);
    expect(nb[0].x).toBeGreaterThan(0);
    expect(nb[0].y).toBeGreaterThan(0);
  });
});

describe('keyboardPasteTarget (issue #104)', () => {
  const rect = {
    left: 100,
    top: 50,
    right: 500,
    bottom: 450,
    width: 400,
    height: 400,
  };

  it('returns the mouse position when it is inside the canvas rect', () => {
    expect(keyboardPasteTarget({ x: 200, y: 120 }, rect)).toEqual({
      x: 200,
      y: 120,
    });
  });

  it('returns the center of the view when the mouse is outside the canvas', () => {
    expect(keyboardPasteTarget({ x: 10, y: 20 }, rect)).toEqual({
      x: 300,
      y: 250,
    });
  });

  it('returns the center of the view when there is no mouse position yet', () => {
    expect(keyboardPasteTarget(null, rect)).toEqual({ x: 300, y: 250 });
  });

  it('returns null when the container rect is unavailable', () => {
    expect(keyboardPasteTarget({ x: 200, y: 120 }, null)).toBeNull();
  });
});
