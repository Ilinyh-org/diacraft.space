import type { Side } from '../Blocks/Block';
import type { BlockData } from '../types';

export function getAnchor(
  block: BlockData,
  side: Side
): { x: number; y: number } {
  const { x, y, width: w, height: h, type } = block;
  // The io (parallelogram) block's slanted edges do not touch the bounding
  // box sides, so side anchors must sit on the actual shape edges (issue #59):
  // shape points are [0.2w,0],[w,0],[0.8w,h],[0,h].
  if (type === 'io') {
    switch (side) {
      case 'top':
        return { x: x + w * 0.6, y };
      case 'bottom':
        return { x: x + w * 0.4, y: y + h };
      case 'left':
        return { x: x + w * 0.1, y: y + h / 2 };
      case 'right':
        return { x: x + w * 0.9, y: y + h / 2 };
    }
  }
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
 * Blocks whose id is `excludeId` (the source block) are skipped, and text
 * comment blocks are never arrow targets (issue #84).
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
    if (b.type === 'text') return false;
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
      return true;
    }
    return SIDES.some((side) => {
      const anchor = getAnchor(b, side);
      return Math.hypot(x - anchor.x, y - anchor.y) <= hitRadius;
    });
  });
}

/**
 * Converts a node's absolute (screen) position into world (layer) coordinates
 * by subtracting the Stage's pan offset and dividing by its scale. Drag events
 * report positions that include the stage transform; canvas geometry (blocks,
 * arrows, anchors) lives in world coordinates, so the transform must be
 * removed before hit testing or rendering (issue #23, zoom in #82).
 */
export function absoluteToWorld(node: {
  getAbsolutePosition: () => { x: number; y: number };
  getStage: () =>
    | { x: () => number; y: () => number; scaleX?: () => number }
    | null;
}): { x: number; y: number } {
  const abs = node.getAbsolutePosition();
  const stage = node.getStage();
  if (!stage) return { x: abs.x, y: abs.y };
  const scale = stage.scaleX?.() ?? 1;
  return {
    x: (abs.x - stage.x()) / scale,
    y: (abs.y - stage.y()) / scale,
  };
}

/**
 * Converts a raw drag position reported by Konva's dragBoundFunc (absolute,
 * screen space — includes the Stage's pan offset and scale) into world
 * (layer) coordinates. Issue #144: comparing this directly against a block's
 * world x/y made the bottom-right resize handle compute a wrong height from
 * the pan offset and teleport during a purely horizontal drag.
 */
export function dragPosToWorld(
  pos: { x: number; y: number },
  stage:
    | { x: () => number; y: () => number; scaleX?: () => number }
    | null,
): { x: number; y: number } {
  if (!stage) return pos;
  const scale = stage.scaleX?.() ?? 1;
  return {
    x: (pos.x - stage.x()) / scale,
    y: (pos.y - stage.y()) / scale,
  };
}

/**
 * Inverse of dragPosToWorld: converts a world point into the absolute
 * (screen) position Konva's dragBoundFunc must return.
 */
export function worldToAbsolute(
  point: { x: number; y: number },
  stage:
    | { x: () => number; y: () => number; scaleX?: () => number }
    | null,
): { x: number; y: number } {
  if (!stage) return point;
  const scale = stage.scaleX?.() ?? 1;
  return {
    x: point.x * scale + stage.x(),
    y: point.y * scale + stage.y(),
  };
}

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
