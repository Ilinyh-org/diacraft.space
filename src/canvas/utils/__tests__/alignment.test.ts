import { describe, expect, it } from 'vitest';
import {
  ALIGNMENT_SNAP_TOLERANCE,
  findAlignmentGuide,
  snapToAlignmentGuide,
} from '../alignment';
import type { BlockData } from '../../types';

function block(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 50
): BlockData {
  return {
    id,
    x,
    y,
    width,
    height,
    type: 'action',
    label: '',
  } as BlockData;
}

describe('findAlignmentGuide', () => {
  it('returns null with no other blocks', () => {
    expect(findAlignmentGuide([block('a', 0, 0)], 'a', 0, 0)).toBeNull();
  });

  it('returns a vertical guide when center x aligns with the closest block below', () => {
    const a = block('a', 0, 0); // center (50, 25)
    const b = block('b', 10, 200); // center (60, 225)
    const guide = findAlignmentGuide([a, b], 'a', 10, 0);
    expect(guide).not.toBeNull();
    expect(guide!.axis).toBe('vertical');
    expect(guide!.position).toBe(60);
    expect(guide!.targetId).toBe('b');
    expect(guide!.from).toBe(225);
    expect(guide!.to).toBe(25);
  });

  it('returns a horizontal guide when center y aligns', () => {
    const a = block('a', 0, 0);
    const b = block('b', 300, 5); // center y 30, dragged center y 25
    const guide = findAlignmentGuide([a, b], 'a', 0, 5);
    expect(guide!.axis).toBe('horizontal');
    expect(guide!.position).toBe(30);
  });

  it('ignores blocks beyond the tolerance', () => {
    const a = block('a', 0, 0); // center (50, 25)
    // both center axes beyond the tolerance
    const far = {
      ...block('b', 10, 100),
      x: 100 + ALIGNMENT_SNAP_TOLERANCE + 1,
      y: 100 + ALIGNMENT_SNAP_TOLERANCE + 1,
    }; // center (159, 134)
    expect(findAlignmentGuide([a, far], 'a', 0, 0)).toBeNull();
  });

  it('picks the closest block when several are within tolerance', () => {
    const a = block('a', 0, 0); // center (50,25)
    const near = block('near', 10, 100); // center (60,125) — dx 5 from dragged
    const far = block('far', 13, 500); // center (63,525)
    const guide = findAlignmentGuide([a, near, far], 'a', 5, 0);
    expect(guide!.targetId).toBe('near');
    expect(guide!.position).toBe(60);
  });

  it('tracks the dragged block as it moves (line disappears when moving away)', () => {
    const a = block('a', 0, 0);
    const b = block('b', 10, 200);
    expect(findAlignmentGuide([a, b], 'a', 10, 0)).not.toBeNull();
    expect(
      findAlignmentGuide([a, b], 'a', 10 + ALIGNMENT_SNAP_TOLERANCE + 1, 0)
    ).toBeNull();
  });

  it('returns null for an unknown dragged id', () => {
    expect(findAlignmentGuide([block('a', 0, 0)], 'zz', 0, 0)).toBeNull();
  });
});

describe('snapToAlignmentGuide', () => {
  it('snaps x for a vertical guide and keeps y', () => {
    const a = block('a', 0, 0);
    const guide = {
      axis: 'vertical' as const,
      position: 60,
      from: 225,
      to: 25,
      targetId: 'b',
    };
    expect(snapToAlignmentGuide(a, 10, 3, guide)).toEqual({ x: 10, y: 3 });
    expect(snapToAlignmentGuide(a, 13, 3, guide)).toEqual({ x: 10, y: 3 });
  });

  it('snaps y for a horizontal guide and keeps x', () => {
    const a = block('a', 0, 0);
    const guide = {
      axis: 'horizontal' as const,
      position: 130,
      from: 100,
      to: 25,
      targetId: 'b',
    };
    expect(snapToAlignmentGuide(a, 7, 8, guide)).toEqual({ x: 7, y: 105 });
  });
});
