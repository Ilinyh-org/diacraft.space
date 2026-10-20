import type { BlockData, ArrowData } from '../types';

/** Snapshot of copied diagram content: blocks plus arrows fully inside it. */
export type Clipboard = {
  blocks: BlockData[];
  arrows: ArrowData[];
};

export function copySelection(
  blocks: BlockData[],
  arrows: ArrowData[],
  selectedIds: string[]
): Clipboard {
  const ids = new Set(selectedIds);
  const copiedBlocks = blocks.filter((b) => ids.has(b.id));
  const copiedArrows = arrows.filter(
    (a) => ids.has(a.fromBlockId) && ids.has(a.toBlockId)
  );
  return { blocks: copiedBlocks, arrows: copiedArrows };
}

/** Bounding box of the clipboard blocks (empty clipboard => null). */
export function clipboardBBox(clipboard: Clipboard) {
  if (clipboard.blocks.length === 0) return null;
  const minX = Math.min(...clipboard.blocks.map((b) => b.x));
  const minY = Math.min(...clipboard.blocks.map((b) => b.y));
  const maxX = Math.max(...clipboard.blocks.map((b) => b.x + b.width));
  const maxY = Math.max(...clipboard.blocks.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Paste the clipboard as new blocks/arrows with fresh ids, translated so the
 * content bbox is centered on `center` (defaults to a small offset from the
 * original position when no cursor point is available).
 */
export function pasteClipboard(
  clipboard: Clipboard,
  center?: { x: number; y: number }
): { blocks: BlockData[]; arrows: ArrowData[] } {
  const bbox = clipboardBBox(clipboard);
  const dx = bbox
    ? center
      ? center.x - (bbox.x + bbox.width / 2)
      : bbox.width / 2 + 20
    : 0;
  const dy = bbox
    ? center
      ? center.y - (bbox.y + bbox.height / 2)
      : bbox.height / 2 + 20
    : 0;

  const idMap = new Map<string, string>();
  const newBlocks = clipboard.blocks.map((b) => {
    const id = crypto.randomUUID();
    idMap.set(b.id, id);
    return { ...b, id, x: b.x + dx, y: b.y + dy };
  });
  const newArrows: ArrowData[] = [];
  for (const a of clipboard.arrows) {
    const fromBlockId = idMap.get(a.fromBlockId);
    const toBlockId = idMap.get(a.toBlockId);
    if (!fromBlockId || !toBlockId) continue;
    newArrows.push({
      ...a,
      id: crypto.randomUUID(),
      fromBlockId,
      toBlockId,
      waypoints: a.waypoints.map((w) => ({ x: w.x + dx, y: w.y + dy })),
    });
  }

  return { blocks: newBlocks, arrows: newArrows };
}
