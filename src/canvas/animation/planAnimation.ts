import type { BlockData, ArrowData } from '../types';

export type AnimStep =
  | { kind: 'block'; id: string }
  | { kind: 'arrow'; id: string };

/** How many times a block may be activated before an endless loop is cut off. */
export const MAX_LOOPS = 10;

/**
 * Build the ordered list of activation steps for an algorithm animation.
 *
 * Rules (see issue #24):
 * - The animation starts at the `start` block.
 * - A block activates only when an input arrow leads from an
 *   already-activated block; the traversed arrow is highlighted in between.
 * - If an endless loop exists, a block may activate at most MAX_LOOPS times;
 *   exceeding the cap stops the animation.
 * - The animation ends when no more blocks can be activated.
 */
export function planAnimation(
  blocks: BlockData[],
  arrows: ArrowData[]
): AnimStep[] {
  const start = blocks.find((b) => b.type === 'start');
  if (!start) return [];

  const steps: AnimStep[] = [];
  const counts = new Map<string, number>();
  const outgoing = (blockId: string) =>
    arrows.filter((a) => a.fromBlockId === blockId);

  let stopped = false;

  const visit = (blockId: string) => {
    if (stopped) return;
    const count = (counts.get(blockId) ?? 0) + 1;
    if (count > MAX_LOOPS) {
      stopped = true;
      return;
    }
    counts.set(blockId, count);
    steps.push({ kind: 'block', id: blockId });

    for (const arrow of outgoing(blockId)) {
      if (stopped) return;
      steps.push({ kind: 'arrow', id: arrow.id });
      visit(arrow.toBlockId);
    }
  };

  visit(start.id);
  return steps;
}
