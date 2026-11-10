import { describe, it, expect } from 'vitest';
import { getContentBBox } from '../export';
import type { BlockData, ArrowData } from '../../types';
import { EXPORT_PADDING } from '../../constants';

function block(id: string, x: number, y: number, w = 120, h = 60): BlockData {
  return { id, x, y, width: w, height: h, label: id, type: 'action' };
}

describe('getContentBBox', () => {
  it('returns null for an empty diagram', () => {
    expect(getContentBBox([], [])).toBeNull();
  });

  it('wraps a single block with padding', () => {
    const b = block('A', 100, 200);
    const bb = getContentBBox([b], []);
    expect(bb).toEqual({
      x: 100 - EXPORT_PADDING,
      y: 200 - EXPORT_PADDING,
      width: 120 + 2 * EXPORT_PADDING,
      height: 60 + 2 * EXPORT_PADDING,
    });
  });

  it('covers multiple blocks', () => {
    const a = block('A', 0, 0);
    const b = block('B', 300, 150);
    const bb = getContentBBox([a, b], []);
    expect(bb).not.toBeNull();
    expect(bb!.x).toBe(0 - EXPORT_PADDING);
    expect(bb!.y).toBe(0 - EXPORT_PADDING);
    expect(bb!.width).toBe(420 + 2 * EXPORT_PADDING);
    expect(bb!.height).toBe(210 + 2 * EXPORT_PADDING);
  });

  it('handles negative coordinates', () => {
    const a = block('A', -500, -300);
    const b = block('B', 100, 100);
    const bb = getContentBBox([a, b], []);
    expect(bb).not.toBeNull();
    expect(bb!.x).toBe(-500 - EXPORT_PADDING);
    expect(bb!.y).toBe(-300 - EXPORT_PADDING);
    expect(bb!.width).toBe(600 + 120 + 2 * EXPORT_PADDING);
    expect(bb!.height).toBe(400 + 60 + 2 * EXPORT_PADDING);
  });

  it('includes arrow waypoints', () => {
    const a = block('A', 0, 0);
    const b = block('B', 300, 100);
    const arrow: ArrowData = {
      id: 'ar',
      fromBlockId: 'A',
      fromSide: 'right',
      toBlockId: 'B',
      toSide: 'left',
      waypoints: [{ x: 500, y: 400 }],
    };
    const bb = getContentBBox([a, b], [arrow]);
    expect(bb).not.toBeNull();
    expect(bb!.width).toBe(500 + 2 * EXPORT_PADDING);
    expect(bb!.height).toBe(400 + 2 * EXPORT_PADDING);
  });

  it('ignores arrows without waypoints', () => {
    const a = block('A', 0, 0);
    const arrow: ArrowData = {
      id: 'ar',
      fromBlockId: 'A',
      fromSide: 'right',
      toBlockId: 'A',
      toSide: 'left',
      waypoints: [],
    };
    const bb = getContentBBox([a], [arrow]);
    expect(bb).not.toBeNull();
    expect(bb!.x).toBe(0 - EXPORT_PADDING);
    expect(bb!.width).toBe(120 + 2 * EXPORT_PADDING);
  });

  it('handles block at origin with zero-ish size', () => {
    const a = block('A', 0, 0, 1, 1);
    const bb = getContentBBox([a], []);
    expect(bb).not.toBeNull();
    expect(bb!.width).toBe(1 + 2 * EXPORT_PADDING);
  });

  it('handles very large coordinates', () => {
    const a = block('A', 10000, 10000);
    const bb = getContentBBox([a], []);
    expect(bb).not.toBeNull();
    expect(bb!.x).toBe(10000 - EXPORT_PADDING);
  });
});
