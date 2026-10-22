import type { ArrowData, BlockData } from '../canvas/types';
import type { Statement, Subprograms } from './types';
import { t, type LanguageCode } from '../canvas/ui/i18n';

/**
 * Compiles the flowchart on the canvas (see issue #30) into the program the
 * built-in game runs. Issue #70 semantics:
 * - io blocks: `out …` prints (pos → coordinates, inv[n] → inventory slot),
 *   `in` asks the player for a direction;
 * - action blocks: movement commands or `inv[n] = item` inventory writes;
 * - condition blocks: wall branches (arrows labeled yes/no, else by side);
 * - for-loop blocks: `3 times` bodies that flow back into the loop block;
 * - function blocks call subprograms: separate flowcharts on the same canvas
 *   whose start block carries the subprogram name. Link blocks are rejected
 *   for now.
 */
export type FlowchartResult =
  | { ok: true; program: Statement[]; subprograms: Subprograms }
  | { ok: false; errors: string[] };

const MOVE_WORDS = new Set(['move', 'left', 'turn left', 'right', 'turn right']);

// Issue #87: text blocks created before the `block.text` translation key
// existed can carry an undefined label; never crash the compiler on it.
const safeLabel = (block: BlockData): string => block.label ?? '';

const parseAction = (label: string): Statement | null => {
  const low = label.trim().toLowerCase();
  if (MOVE_WORDS.has(low)) {
    if (low === 'left' || low === 'turn left') return { kind: 'turnLeft' };
    if (low === 'right' || low === 'turn right') return { kind: 'turnRight' };
    return { kind: 'move' };
  }
  const inv = low.match(/^inv\[(\d+)\]\s*=/);
  if (inv) return { kind: 'setInv', index: Number(inv[1]) };
  return null;
};

const parseIo = (label: string): Statement | null => {
  const low = label.trim().toLowerCase();
  if (/^(in|input|ввод)$/.test(low) || low.startsWith('in ') || low.startsWith('ввод ')) {
    return { kind: 'inputDir' };
  }
  const out = low.match(/^(out|output|вывод)\s*([\s\S]*)$/);
  if (out) return { kind: 'output', text: out[2].trim() };
  return null;
};

const parseLoopTimes = (label: string): number | null => {
  const m = label.match(/(\d+)\s*(x|times|раз)?/i);
  return m ? Number(m[1]) : null;
};

const isYesLabel = (label: string | undefined): boolean =>
  !!label && /^(yes|y|\+|да)/i.test(label.trim());

export const isEndBlock = (block: BlockData): boolean =>
  safeLabel(block).trim().toLowerCase() === 'end';

export const isStartBlock = (block: BlockData): boolean =>
  block.type === 'start' && !isEndBlock(block);

/**
 * Maps an activated diagram block to the game statement it triggers
 * (issue #40). Start and End blocks trigger nothing; unknown action labels
 * return null.
 */
export function statementForBlock(block: BlockData): Statement | null {
  if (isStartBlock(block) || isEndBlock(block)) return null;
  if (block.type === 'io') return parseIo(block.label);
  return parseAction(block.label);
}

type Ctx = {
  blocks: BlockData[];
  arrows: ArrowData[];
  errors: string[];
  language: LanguageCode;
  loopHeaders: Set<string>;
  /** Every block that any compilation path reached. */
  reachable: Set<string>;
};

const err = (ctx: Ctx, key: Parameters<typeof t>[1], params?: Record<string, string>) =>
  ctx.errors.push(t(ctx.language, key, params));

const outgoing = (ctx: Ctx, id: string) =>
  ctx.arrows.filter((a) => a.fromBlockId === id);

const target = (ctx: Ctx, blockId: string): BlockData | undefined =>
  ctx.blocks.find((b) => b.id === blockId);

/**
 * Walks a linear chain of blocks starting at `startId`, stopping at End, at
 * branch/loop constructs (which own their continuation), or when the walk
 * re-enters an already visited block (loop back-edge or join).
 */
function compileFrom(
  ctx: Ctx,
  startId: string,
  seen: Set<string>,
  stopAt?: string,
): Statement[] {
  const program: Statement[] = [];
  let current: BlockData | undefined = target(ctx, startId);
  let guard = 0;

  while (current && !isEndBlock(current)) {
    if (current.id === stopAt) break; // loop body flows back into the header
    if (guard++ > 200 || seen.has(current.id)) break;

    if (current.type === 'condition') {
      seen.add(current.id);
      ctx.reachable.add(current.id);
      program.push(compileCondition(ctx, current, seen));
      break; // branches own the continuation
    }

    if (current.type === 'forloop') {
      seen.add(current.id);
      ctx.reachable.add(current.id);
      const entries = chainTargets(ctx, current);
      const times = parseLoopTimes(safeLabel(current));
      if (times === null) {
        err(ctx, 'flow.unknownAction', { label: safeLabel(current) });
        return program;
      }
      // The body arrow is the one whose chain flows back into the header.
      const returnsToLoop = (entry: { to: BlockData | undefined }): boolean => {
        let cur = entry.to;
        for (let hops = 0; cur && hops < 50; hops += 1) {
          if (cur.id === current!.id) return true;
          const next = outgoing(ctx, cur.id)[0];
          cur = next ? target(ctx, next.toBlockId) : undefined;
        }
        return false;
      };
      let bodyEntry = entries.find(returnsToLoop);
      const exitEntry = entries.find((e) => e !== bodyEntry);
      if (!bodyEntry && entries.length === 1) bodyEntry = entries[0];
      if (!bodyEntry) {
        err(ctx, 'flow.mustReachEnd');
        return program;
      }
      const body = compileFrom(ctx, bodyEntry.to!.id, new Set(seen), current.id);
      program.push({ kind: 'repeat', times, body });
      if (!exitEntry) break;
      current = exitEntry.to!;
      continue;
    }

    seen.add(current.id);
    ctx.reachable.add(current.id);
    const outs = outgoing(ctx, current.id);
    if (outs.length === 0) {
      err(ctx, 'flow.mustReachEnd');
      return program;
    }
    if (outs.length > 1) {
      err(ctx, 'flow.multipleOutgoing', { label: safeLabel(current) });
      return program;
    }
    const next = target(ctx, outs[0].toBlockId);
    if (!next) {
      err(ctx, 'flow.arrowMissing');
      return program;
    }

    if (current.type === 'link') {
      err(ctx, 'flow.unknownAction', { label: current.label });
      return program;
    }

    const stmt =
      current.type === 'io' ? parseIo(safeLabel(current)) : parseAction(safeLabel(current));
    if (current.type === 'function') {
      program.push({ kind: 'call', name: safeLabel(current).trim() });
    } else if (!stmt) {
      err(ctx, 'flow.unknownAction', { label: safeLabel(current) });
      return program;
    } else {
      program.push(stmt);
    }
    current = next;
  }
  return program;
}

const chainTargets = (ctx: Ctx, block: BlockData) =>
  outgoing(ctx, block.id)
    .map((a) => ({ arrow: a, to: target(ctx, a.toBlockId) }))
    .filter((e) => !!e.to);

function compileCondition(ctx: Ctx, cond: BlockData, seen: Set<string>): Statement {
  const entries = chainTargets(ctx, cond);
  const yesEntry =
    entries.find((e) => isYesLabel(e.arrow.label)) ??
    entries.find((e) => e.arrow.fromSide === 'bottom' || e.arrow.fromSide === 'right');
  const noEntry = entries.find((e) => e !== yesEntry);
  return {
    kind: 'ifWall',
    then: yesEntry ? compileFrom(ctx, yesEntry.to!.id, new Set(seen)) : [],
    else: noEntry ? compileFrom(ctx, noEntry.to!.id, new Set(seen)) : [],
  };
}

function compileStart(ctx: Ctx, start: BlockData, seen: Set<string>): Statement[] {
  const outs = outgoing(ctx, start.id);
  if (outs.length === 0) {
    err(ctx, 'flow.mustReachEnd');
    return [];
  }
  if (outs.length > 1) {
    err(ctx, 'flow.multipleOutgoing', { label: safeLabel(start) });
    return [];
  }
  return compileFrom(ctx, outs[0].toBlockId, seen);
}

export function compileFlowchart(
  blocks: BlockData[],
  arrows: ArrowData[],
  language: LanguageCode = 'en',
): FlowchartResult {
  const errors: string[] = [];
  const ctx: Ctx = {
    blocks,
    arrows,
    errors,
    language,
    loopHeaders: new Set(),
    reachable: new Set(),
  };

  const starts = blocks.filter(isStartBlock);
  const main = starts.find((s) => safeLabel(s).trim().toLowerCase() === 'start');
  if (!main) {
    return { ok: false, errors: [t(language, 'flow.noStart')] };
  }

  const visited = new Set<string>([main.id, ...blocks.filter(isEndBlock).map((b) => b.id)]);
  const program = compileStart(ctx, main, visited);
  ctx.reachable.add(main.id);
  for (const s of starts) ctx.reachable.add(s.id);
  for (const e of blocks.filter(isEndBlock)) ctx.reachable.add(e.id);

  const subprograms: Subprograms = {};
  for (const sub of starts) {
    if (sub.id === main.id) continue;
    const name = safeLabel(sub).trim();
    if (!name || name.toLowerCase() === 'end') continue;
    ctx.reachable.add(sub.id);
    const outs = outgoing(ctx, sub.id);
    subprograms[name] =
      outs.length === 1 ? compileFrom(ctx, outs[0].toBlockId, new Set([sub.id])) : [];
  }

  if (errors.length === 0) {
    for (const block of blocks) {
      // Text comment blocks (issue #84) are annotations, never part of the
      // executed flowchart, so they must not be flagged as redundant.
      if (block.type === 'text') continue;
      if (!ctx.reachable.has(block.id)) {
      errors.push(t(language, 'flow.notPartOfFlowchart', { label: safeLabel(block) }));
      }
    }
  }

  return errors.length === 0
    ? { ok: true, program, subprograms }
    : { ok: false, errors };
}
