import { describe, expect, it } from 'vitest';
import { compileFlowchart, isEndBlock } from '../flowchart';
import type { BlockData, ArrowData } from '../../canvas/types';
import type { Statement } from '../types';

let nextId = 0;

function block(
  overrides: Partial<BlockData> = {},
): BlockData {
  nextId += 1;
  return {
    id: `b${nextId}`,
    x: 0,
    y: 0,
    width: 120,
    height: 60,
    label: 'Action',
    type: 'action',
    ...overrides,
  };
}

function arrow(
  fromBlockId: string,
  toBlockId: string,
  overrides: Partial<ArrowData> = {},
): ArrowData {
  nextId += 1;
  return {
    id: `a${nextId}`,
    fromBlockId,
    fromSide: 'bottom',
    toBlockId,
    toSide: 'top',
    waypoints: [],
    ...overrides,
  };
}

const programKinds = (program: Statement[]) =>
  program.map((s) => s.kind);

describe('compileFlowchart', () => {
  it('compiles a valid start → actions → end chain', () => {
    const start = block({ type: 'start', label: 'Start' });
    const move = block({ label: 'move' });
    const left = block({ label: 'Left' });
    const end = block({ label: 'End' });
    const result = compileFlowchart(
      [start, move, left, end],
      [arrow(start.id, move.id), arrow(move.id, left.id), arrow(left.id, end.id)],
    );
    expect(result).toEqual({
      ok: true,
      program: [{ kind: 'move' }, { kind: 'turnLeft' }],
    });
  });

  it('reports a missing start block', () => {
    const end = block({ label: 'End' });
    const result = compileFlowchart([end], []);
    expect(result).toEqual({
      ok: false,
      errors: ['Add a Start block to the canvas.'],
    });
  });

  it('reports a chain that never reaches an end block', () => {
    const start = block({ type: 'start', label: 'Start' });
    const move = block({ label: 'move' });
    const result = compileFlowchart([start, move], [arrow(start.id, move.id)]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('End block');
    }
  });

  it('reports an unknown action label', () => {
    const start = block({ type: 'start', label: 'Start' });
    const jump = block({ label: 'jump' });
    const end = block({ label: 'end' });
    const result = compileFlowchart(
      [start, jump, end],
      [arrow(start.id, jump.id), arrow(jump.id, end.id)],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('Unknown action "jump"');
    }
  });

  it('reports blocks with more than one outgoing arrow', () => {
    const start = block({ type: 'start', label: 'Start' });
    const move = block({ label: 'move' });
    const end = block({ label: 'end' });
    const result = compileFlowchart(
      [start, move, end],
      [arrow(start.id, move.id), arrow(start.id, end.id)],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('more than one outgoing arrow');
    }
  });

  it('reports blocks that are not part of the flowchart', () => {
    const start = block({ type: 'start', label: 'Start' });
    const end = block({ label: 'end' });
    const stray = block({ label: 'move' });
    const result = compileFlowchart(
      [start, end, stray],
      [arrow(start.id, end.id)],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('not part of the flowchart');
    }
  });

  it('accepts a start block that goes straight to the end', () => {
    const start = block({ type: 'start', label: 'Start' });
    const end = block({ label: 'end' });
    const result = compileFlowchart([start, end], [arrow(start.id, end.id)]);
    expect(result).toEqual({ ok: true, program: [] });
  });

  it('detects end blocks by label', () => {
    const end = block({ label: '  END  ' });
    expect(isEndBlock(end)).toBe(true);
    expect(isEndBlock(block({ label: 'move' }))).toBe(false);
  });

  it('maps turn labels in both short and long form', () => {
    const start = block({ type: 'start', label: 'Start' });
    const a = block({ label: 'turn left' });
    const b = block({ label: 'right' });
    const end = block({ label: 'end' });
    const result = compileFlowchart(
      [start, a, b, end],
      [arrow(start.id, a.id), arrow(a.id, b.id), arrow(b.id, end.id)],
    );
    expect(result.ok && programKinds(result.program)).toEqual([
      'turnLeft',
      'turnRight',
    ]);
  });
});
