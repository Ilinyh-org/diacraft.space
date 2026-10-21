import type { ArrowData, BlockData } from '../canvas/types';
import type { Statement } from './types';
import { t, type LanguageCode } from '../canvas/ui/i18n';

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
  language: LanguageCode = 'en',
): FlowchartResult {
  const start = blocks.find((b) => b.type === 'start');
  if (!start) {
    return { ok: false, errors: [t(language, 'flow.noStart')] };
  }

  const errors: string[] = [];
  const program: Statement[] = [];
  const visited = new Set<string>([start.id]);
  const outgoing = (id: string) => arrows.filter((a) => a.fromBlockId === id);

  let current: BlockData | undefined = start;

  while (current && !isEndBlock(current)) {
    const outs = outgoing(current.id);
    if (outs.length === 0) {
      errors.push(t(language, 'flow.mustReachEnd'));
      break;
    }
    if (outs.length > 1) {
      errors.push(
        t(language, 'flow.multipleOutgoing', { label: current.label }),
      );
      break;
    }
    const next = blocks.find((b) => b.id === outs[0].toBlockId);
    if (!next) {
      errors.push(t(language, 'flow.arrowMissing'));
      break;
    }
    if (visited.has(next.id)) {
      errors.push(t(language, 'flow.noLoops'));
      break;
    }
    if (current.id !== start.id) {
      const stmt = ACTION_BY_LABEL[current.label.trim().toLowerCase()];
      if (!stmt) {
        errors.push(
          t(language, 'flow.unknownAction', { label: current.label }),
        );
        break;
      }
      program.push(stmt);
    }
    visited.add(next.id);
    current = next;
  }

  if (errors.length === 0 && !(current && isEndBlock(current))) {
    errors.push(t(language, 'flow.mustReachEnd'));
  }

  if (errors.length === 0) {
    for (const block of blocks) {
      if (!visited.has(block.id)) {
        errors.push(
          t(language, 'flow.notPartOfFlowchart', { label: block.label }),
        );
      }
    }
  }

  return errors.length === 0
    ? { ok: true, program }
    : { ok: false, errors };
}
