import { describe, it, expect } from 'vitest';
import { findDropTarget, getAnchor } from '../blocks';
import type { BlockData } from '../../types';

function block(id: string, x: number, y: number, w = 120, h = 60): BlockData {
  return { id, x, y, width: w, height: h, label: id, type: 'action' };
}

const HIT_RADIUS = 19.8; // CONNECTION_AREA_HIT_RADIUS

describe('findDropTarget', () => {
  const a = block('a', 100, 100);
  const b = block('b', 400, 100);

  it('finds a block when the drop point is inside its bounds', () => {
    expect(findDropTarget([a, b], 'a', 450, 120, HIT_RADIUS)?.id).toBe('b');
  });

  it('finds a block when the drop point is inside a connection area circle', () => {
    // Right anchor of block b: (520, 130); drop 10px outside it.
    expect(findDropTarget([a, b], 'a', 530, 130, HIT_RADIUS)?.id).toBe('b');
  });

  it('returns undefined when the drop point is outside every area', () => {
    expect(
      findDropTarget([a, b], 'a', 350, 130, HIT_RADIUS)
    ).toBeUndefined();
  });

  it('never targets the excluded source block', () => {
    // Drop inside block a's bounds but exclude it.
    expect(findDropTarget([a, b], 'a', 150, 120, HIT_RADIUS)).toBeUndefined();
  });

  it('respects the hit radius at the circle boundary', () => {
    // Exactly at the boundary counts; just beyond it does not.
    const edge = 520 + HIT_RADIUS;
    expect(findDropTarget([a, b], 'a', edge, 130, HIT_RADIUS)?.id).toBe('b');
    expect(
      findDropTarget([a, b], 'a', edge + 0.5, 130, HIT_RADIUS)
    ).toBeUndefined();
  });
});

describe('getAnchor for io (parallelogram) blocks', () => {
  // io shape points: [0.2w,0],[w,0],[0.8w,h],[0,h]
  const io = block('io', 100, 100);
  io.type = 'io';

  it('anchors on the slanted left edge midpoint, not the bounding box', () => {
    expect(getAnchor(io, 'left')).toEqual({ x: 100 + 12, y: 130 });
  });

  it('anchors on the slanted right edge midpoint, not the bounding box', () => {
    expect(getAnchor(io, 'right')).toEqual({ x: 100 + 108, y: 130 });
  });

  it('centers the top anchor on the top edge of the parallelogram', () => {
    expect(getAnchor(io, 'top')).toEqual({ x: 100 + 72, y: 100 });
  });

  it('centers the bottom anchor on the bottom edge of the parallelogram', () => {
    expect(getAnchor(io, 'bottom')).toEqual({ x: 100 + 48, y: 160 });
  });
});
