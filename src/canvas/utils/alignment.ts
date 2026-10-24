import type { BlockData } from '../types';

/**
 * Alignment guides (issue #116): while a block is dragged, a dashed blue
 * line appears when the dragged block's center x (or y) matches the center
 * x (or y) of the closest other block. Dropping while the guide is visible
 * snaps the block onto the guide.
 */

export type GuideAxis = 'vertical' | 'horizontal';

export type AlignmentGuide = {
  axis: GuideAxis;
  /** Guide line position: shared center x for vertical, center y for horizontal. */
  position: number;
  /** Line extent along the other axis (center of the other block). */
  from: number;
  /** Line extent along the other axis (center of the dragged block). */
  to: number;
  targetId: string;
};

export const ALIGNMENT_SNAP_TOLERANCE = 8;

export function blockCenter(block: BlockData): { cx: number; cy: number } {
  return { cx: block.x + block.width / 2, cy: block.y + block.height / 2 };
}

/**
 * Find the alignment guide for a dragged block at origin (x, y).
 * Vertical guide: center x matches another block's center x; among the
 * candidates, the closest block wins. Horizontal guide: same for center y.
 * Returns null when no other block is within the tolerance.
 */
export function findAlignmentGuide(
  blocks: BlockData[],
  dragId: string,
  x: number,
  y: number,
  tolerance: number = ALIGNMENT_SNAP_TOLERANCE
): AlignmentGuide | null {
  const dragged = blocks.find((b) => b.id === dragId);
  if (!dragged) return null;
  const cx = x + dragged.width / 2;
  const cy = y + dragged.height / 2;

  let best: { guide: AlignmentGuide; dist: number } | null = null;

  for (const b of blocks) {
    if (b.id === dragId) continue;
    const { cx: ocx, cy: ocy } = blockCenter(b);

    if (Math.abs(ocx - cx) <= tolerance) {
      const dist = Math.abs(ocy - cy);
      if (!best || dist < best.dist) {
        best = {
          dist,
          guide: {
            axis: 'vertical',
            position: ocx,
            from: ocy,
            to: cy,
            targetId: b.id,
          },
        };
      }
    }

    if (Math.abs(ocy - cy) <= tolerance) {
      const dist = Math.abs(ocx - cx);
      if (!best || dist < best.dist) {
        best = {
          dist,
          guide: {
            axis: 'horizontal',
            position: ocy,
            from: ocx,
            to: cx,
            targetId: b.id,
          },
        };
      }
    }
  }

  return best?.guide ?? null;
}

/**
 * Snap a dragged block (origin x, y) so its center aligns with the guide.
 * Only the guide axis is adjusted; the other coordinate is kept.
 */
export function snapToAlignmentGuide(
  dragged: BlockData,
  x: number,
  y: number,
  guide: AlignmentGuide
): { x: number; y: number } {
  if (guide.axis === 'vertical') {
    return { x: guide.position - dragged.width / 2, y };
  }
  return { x, y: guide.position - dragged.height / 2 };
}
