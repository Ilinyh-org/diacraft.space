import type { ArrowData, BlockData } from '../canvas/types';
import type { Statement } from './types';

/**
 * Compiles the flowchart on the canvas (see issue #30) into the program the
 * built-in game runs. The user places a Start block, action blocks renamed to
 * commands (Move, Left, Right) and an End block, connected by arrows.
 */
export type FlowchartResult =
  | { ok: true; program: Statement[] }
  | { ok: false; errors: string[] };

const ACTION_BY_LABEL: Record<string, Statement> = {
  move: { kind: 'move' },
  left: { kind: 'turnLeft' },
  'turn left': { kind: 'turnLeft' },
  right: { kind: 'turnRight' },
  'turn right': { kind: 'turnRight' },
};

export const isEndBlock = (block: BlockData): boolean =>
  block.label.trim().toLowerCase() === 'end';

/**
 * Maps an activated diagram block to the game statement it triggers
 * (issue #40). Start and End blocks trigger nothing; unknown action labels
 * return null.
 */
export function statementForBlock(block: BlockData): Statement | null {
  if (block.type === 'start' || isEndBlock(block)) return null;
  return ACTION_BY_LABEL[block.label.trim().toLowerCase()] ?? null;
}

export function compileFlowchart(
  blocks: BlockData[],
  arrows: ArrowData[],
): FlowchartResult {
  const start = blocks.find((b) => b.type === 'start');
  if (!start) {
    return { ok: false, errors: ['Add a Start block to the canvas.'] };
  }

  const errors: string[] = [];
  const program: Statement[] = [];
  const visited = new Set<string>([start.id]);
  const outgoing = (id: string) => arrows.filter((a) => a.fromBlockId === id);

  let current: BlockData | undefined = start;

  while (current && !isEndBlock(current)) {
    const outs = outgoing(current.id);
    if (outs.length === 0) {
      errors.push('The flowchart must reach an End block.');
      break;
    }
    if (outs.length > 1) {
      errors.push(
        `Block "${current.label}" has more than one outgoing arrow.`,
      );
      break;
    }
    const next = blocks.find((b) => b.id === outs[0].toBlockId);
    if (!next) {
      errors.push('An arrow points to a missing block.');
      break;
    }
    if (visited.has(next.id)) {
      errors.push('The flowchart must not contain loops.');
      break;
    }
    if (current.id !== start.id) {
      const stmt = ACTION_BY_LABEL[current.label.trim().toLowerCase()];
      if (!stmt) {
        errors.push(
          `Unknown action "${current.label}". Rename the block to Move, Turn left or Turn right.`,
        );
        break;
      }
      program.push(stmt);
    }
    visited.add(next.id);
    current = next;
  }

  if (errors.length === 0 && !(current && isEndBlock(current))) {
    errors.push('The flowchart must reach an End block.');
  }

  if (errors.length === 0) {
    for (const block of blocks) {
      if (!visited.has(block.id)) {
        errors.push(`Block "${block.label}" is not part of the flowchart.`);
      }
    }
  }

  return errors.length === 0
    ? { ok: true, program }
    : { ok: false, errors };
}
