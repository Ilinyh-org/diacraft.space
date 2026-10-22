import { describe, expect, it } from 'vitest';
import { compileFlowchart } from '../flowchart';
import type { ArrowData, BlockData } from '../../canvas/types';

let nextId = 0;
const block = (label: string, type: BlockData['type'] = 'action'): BlockData => {
  nextId += 1;
  return {
    id: `b${nextId}`,
    x: 0,
    y: 0,
    width: 120,
    height: 60,
    label,
    type,
  };
};
const arrow = (
  fromBlockId: string,
  toBlockId: string,
  fromSide: ArrowData['fromSide'] = 'bottom',
  label?: string,
): ArrowData => {
  nextId += 1;
  return {
    id: `a${nextId}`,
    fromBlockId,
    fromSide,
    toBlockId,
    toSide: 'top',
    waypoints: [],
    label,
  };
};

describe('compileFlowchart (#70 semantics)', () => {
  it('compiles io blocks to output/input statements', () => {
    const start = block('Start', 'start');
    const out = block('out pos', 'io');
    const input = block('in', 'io');
    const end = block('End', 'start');
    const blocks = [start, out, input, end];
    const arrows = [
      arrow(start.id, out.id),
      arrow(out.id, input.id),
      arrow(input.id, end.id),
    ];
    const result = compileFlowchart(blocks, arrows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.program).toEqual([
        { kind: 'output', text: 'pos' },
        { kind: 'inputDir' },
      ]);
    }
  });

  it('compiles an inventory assignment action block', () => {
    const start = block('Start', 'start');
    const take = block('inv[0] = item');
    const end = block('End', 'start');
    const blocks = [start, take, end];
    const result = compileFlowchart(blocks, [
      arrow(start.id, take.id),
      arrow(take.id, end.id),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.program).toEqual([{ kind: 'setInv', index: 0 }]);
  });

  it('compiles a wall condition into ifWall with both branches', () => {
    const start = block('Start', 'start');
    const cond = block('wall ahead?', 'condition');
    const detour = block('left');
    const step = block('move');
    const end = block('End', 'start');
    const blocks = [start, cond, detour, step, end];
    const arrows = [
      arrow(start.id, cond.id),
      arrow(cond.id, detour.id, 'bottom', 'yes'),
      arrow(cond.id, step.id, 'right', 'no'),
      arrow(detour.id, end.id),
      arrow(step.id, end.id),
    ];
    const result = compileFlowchart(blocks, arrows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.program).toEqual([
        {
          kind: 'ifWall',
          then: [{ kind: 'turnLeft' }],
          else: [{ kind: 'move' }],
        },
      ]);
    }
  });

  it('compiles a for-loop block with a body that returns to the loop', () => {
    const start = block('Start', 'start');
    const loop = block('3 times', 'forloop');
    const step = block('move');
    const end = block('End', 'start');
    const blocks = [start, loop, step, end];
    const arrows = [
      arrow(start.id, loop.id),
      arrow(loop.id, step.id, 'bottom'),
      arrow(step.id, loop.id, 'top'),
      arrow(loop.id, end.id, 'right'),
    ];
    const result = compileFlowchart(blocks, arrows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.program).toEqual([
        { kind: 'repeat', times: 3, body: [{ kind: 'move' }] },
      ]);
    }
  });

  it('compiles function blocks into calls of same-canvas subprograms', () => {
    const main = block('Start', 'start');
    const call = block('walk', 'function');
    const end = block('End', 'start');
    const subStart = block('walk', 'start');
    const step = block('move');
    const subEnd = block('End', 'start');
    const blocks = [main, call, end, subStart, step, subEnd];
    const result = compileFlowchart(blocks, [
      arrow(main.id, call.id),
      arrow(call.id, end.id),
      arrow(subStart.id, step.id),
      arrow(step.id, subEnd.id),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.program).toEqual([{ kind: 'call', name: 'walk' }]);
      expect(result.subprograms.walk).toEqual([{ kind: 'move' }]);
    }
  });

  it('rejects a link block for now', () => {
    const start = block('Start', 'start');
    const link = block('go here', 'link');
    const end = block('End', 'start');
    const result = compileFlowchart(
      [start, link, end],
      [arrow(start.id, link.id), arrow(link.id, end.id)],
    );
    expect(result.ok).toBe(false);
  });
});
