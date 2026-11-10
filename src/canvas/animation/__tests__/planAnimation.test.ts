import { describe, expect, it } from 'vitest';
import { planAnimation, MAX_LOOPS } from '../planAnimation';
import type { BlockData, ArrowData } from '../../types';

function block(
  id: string,
  type: BlockData['type'] = 'action'
): BlockData {
  return {
    id,
    x: 0,
    y: 0,
    width: 120,
    height: 60,
    label: id,
    type,
  };
}

function arrow(
  id: string,
  fromBlockId: string,
  toBlockId: string
): ArrowData {
  return {
    id,
    fromBlockId,
    fromSide: 'bottom',
    toBlockId,
    toSide: 'top',
    waypoints: [],
  };
}

describe('planAnimation', () => {
  it('returns an empty plan when there is no start block', () => {
    const steps = planAnimation([block('a'), block('b')], [arrow('e1', 'a', 'b')]);
    expect(steps).toEqual([]);
  });

  it('highlights blocks one after another starting from the start block', () => {
    const steps = planAnimation(
      [block('a', 'start'), block('b'), block('c')],
      [arrow('e1', 'a', 'b'), arrow('e2', 'b', 'c')]
    );
    expect(steps).toEqual([
      { kind: 'block', id: 'a' },
      { kind: 'arrow', id: 'e1' },
      { kind: 'block', id: 'b' },
      { kind: 'arrow', id: 'e2' },
      { kind: 'block', id: 'c' },
    ]);
  });

  it('only activates blocks reachable through arrows from activated blocks', () => {
    const steps = planAnimation(
      [block('a', 'start'), block('orphan')],
      []
    );
    expect(steps).toEqual([{ kind: 'block', id: 'a' }]);
  });

  it('stops the animation after the last block is activated', () => {
    const steps = planAnimation(
      [block('a', 'start'), block('b')],
      [arrow('e1', 'a', 'b')]
    );
    expect(steps[steps.length - 1]).toEqual({ kind: 'block', id: 'b' });
  });

  it('caps an endless loop at MAX_LOOPS activations per block', () => {
    const blocks = [block('a', 'start'), block('b')];
    const arrows = [arrow('e1', 'a', 'b'), arrow('e2', 'b', 'a')];
    const steps = planAnimation(blocks, arrows);

    const aActivations = steps.filter(
      (s) => s.kind === 'block' && s.id === 'a'
    ).length;
    const bActivations = steps.filter(
      (s) => s.kind === 'block' && s.id === 'b'
    ).length;
    expect(aActivations).toBe(MAX_LOOPS);
    expect(bActivations).toBe(MAX_LOOPS);
  });

  it('activates every branch leaving a block', () => {
    const steps = planAnimation(
      [block('a', 'start'), block('b'), block('c')],
      [arrow('e1', 'a', 'b'), arrow('e2', 'a', 'c')]
    );
    const lastBlocks = steps.filter((s) => s.kind === 'block');
    expect(lastBlocks).toEqual([
      { kind: 'block', id: 'a' },
      { kind: 'block', id: 'b' },
      { kind: 'block', id: 'c' },
    ]);
  });
});
