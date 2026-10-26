import { describe, expect, it } from 'vitest';
import { compileFlowchart, statementForBlock } from '../flowchart';
import type { ArrowData, BlockData } from '../../canvas/types';
import type { Level } from '../types';

let nextId = 0;
const block = (label: string, type: BlockData['type'] = 'io'): BlockData => {
  nextId += 1;
  return { id: `b${nextId}`, x: 0, y: 0, width: 120, height: 60, label, type };
};
const arrow = (fromBlockId: string, toBlockId: string): ArrowData => {
  nextId += 1;
  return {
    id: `a${nextId}`,
    fromBlockId,
    fromSide: 'bottom',
    toBlockId,
    toSide: 'top',
    waypoints: [],
    label: undefined,
  };
};

const passwordLevel: Level = {
  id: 'conditions-8',
  title: '8',
  concept: 'conditions',
  description: '',
  width: 3,
  height: 1,
  walls: [],
  doors: [[1, 0]],
  password: '1234',
  inputName: 'Input Password',
  start: { x: 0, y: 0, dir: 1 },
  goal: { x: 2, y: 0 },
  allowed: ['move', 'output', 'inputDir'],
};

const linear = (inputLabel: string): { blocks: BlockData[]; arrows: ArrowData[] } => {
  const start = block('Start', 'start');
  const input = block(inputLabel, 'io');
  const end = block('End', 'start');
  return {
    blocks: [start, input, end],
    arrows: [arrow(start.id, input.id), arrow(input.id, end.id)],
  };
};

/**
 * Issue #149: the game must check not just the input block's type and
 * default name, but that its name is exactly the one given by the level
 * task (e.g. "Input Password" on the locked-door level).
 */
describe('issue #149: input block name must match the level task', () => {
  it('accepts the exact task name "Input Password" as an input block', () => {
    const { blocks, arrows } = linear('Input Password');
    const result = compileFlowchart(blocks, arrows, 'en', {
      inputName: passwordLevel.inputName,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.program).toEqual([{ kind: 'inputDir' }]);
  });

  it('accepts the exact task name case-insensitively', () => {
    const { blocks, arrows } = linear('input password');
    const result = compileFlowchart(blocks, arrows, 'en', {
      inputName: passwordLevel.inputName,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a plain default name "Input" when the task requires "Input Password"', () => {
    const { blocks, arrows } = linear('Input');
    const result = compileFlowchart(blocks, arrows, 'en', {
      inputName: passwordLevel.inputName,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('Input Password');
    }
  });

  it('rejects an arbitrary differently named input block', () => {
    const { blocks, arrows } = linear('Input Secret');
    const result = compileFlowchart(blocks, arrows, 'en', {
      inputName: passwordLevel.inputName,
    });
    expect(result.ok).toBe(false);
  });

  it('still accepts default input names when the level has no name requirement', () => {
    const { blocks, arrows } = linear('input');
    const result = compileFlowchart(blocks, arrows);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.program).toEqual([{ kind: 'inputDir' }]);
  });

  it('statementForBlock returns null for a mismatched input name on the level', () => {
    const mismatched = block('Input', 'io');
    expect(statementForBlock(mismatched, passwordLevel)).toBeNull();
    const matching = block('Input Password', 'io');
    expect(statementForBlock(matching, passwordLevel)).toEqual({ kind: 'inputDir' });
  });
});

/**
 * Issue #149: the game menu showed the same error hint twice (once from the
 * error-hint list and once from the status line). Compiled errors must be
 * deduplicated.
 */
describe('issue #149: duplicated error hints', () => {
  it('reports each compile error only once', () => {
    // A condition block with no reachable End on either branch used to be
    // able to push the same "must reach an End block" hint twice.
    const start = block('Start', 'start');
    const cond = block('If wall ahead', 'condition');
    const dead = block('move', 'action'); // no outgoing arrow → mustReachEnd
    const end = block('End', 'start');
    const blocks = [start, cond, dead, end];
    const arrows = [arrow(start.id, cond.id), arrow(cond.id, dead.id)];
    const result = compileFlowchart(blocks, arrows);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const counts = new Map<string, number>();
      for (const e of result.errors) counts.set(e, (counts.get(e) ?? 0) + 1);
      for (const [e, n] of counts) expect(n, e).toBe(1);
    }
  });
});
