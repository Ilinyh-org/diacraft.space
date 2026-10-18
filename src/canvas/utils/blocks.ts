import type { Side } from '../Blocks/Block';
import type { BlockData } from '../types';

export function getAnchor(
  block: BlockData,
  side: Side
): { x: number; y: number } {
  const { x, y, width: w, height: h } = block;
  switch (side) {
    case 'top':
      return { x: x + w / 2, y };
    case 'right':
      return { x: x + w, y: y + h / 2 };
    case 'bottom':
      return { x: x + w / 2, y: y + h };
    case 'left':
      return { x, y: y + h / 2 };
  }
}

export function pickClosestSide(
  block: BlockData,
  x: number,
  y: number
): Side {
  const cx = block.x + block.width / 2;
  const cy = block.y + block.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'bottom' : 'top';
}

/**
 * Find the block a connection drop at (x, y) should attach to.
 *
 * A drop inside a block's bounds, or inside the hit radius of any of its
 * side anchors (the visible connection area circles), attaches the arrow.
 * Blocks whose id is `excludeId` (the source block) are skipped.
 */
export function findDropTarget(
  blocks: BlockData[],
  excludeId: string,
  x: number,
  y: number,
  hitRadius: number
): BlockData | undefined {
  return blocks.find((b) => {
    if (b.id === excludeId) return false;
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
      return true;
    }
    return SIDES.some((side) => {
      const anchor = getAnchor(b, side);
      return Math.hypot(x - anchor.x, y - anchor.y) <= hitRadius;
    });
  });
}

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
