import { describe, expect, it } from 'vitest';
import { absoluteToWorld } from '../blocks';

/**
 * Regression tests for issue #23: connection-handle drag events report the
 * handle position via getAbsolutePosition(), which includes the Stage's pan
 * offset (screen coordinates). The preview arrow and drop-target hit testing
 * need world (layer) coordinates, so the stage offset must be subtracted.
 */
describe('absoluteToWorld', () => {
  it('returns the absolute position unchanged when the stage is not panned', () => {
    const node = {
      getAbsolutePosition: () => ({ x: 120, y: 80 }),
      getStage: () => ({ x: () => 0, y: () => 0 }),
    };
    expect(absoluteToWorld(node)).toEqual({ x: 120, y: 80 });
  });

  it('subtracts the stage pan offset from the absolute position', () => {
    const node = {
      getAbsolutePosition: () => ({ x: 905 + 265, y: 189 + 216 }),
      getStage: () => ({ x: () => 905, y: () => 189 }),
    };
    expect(absoluteToWorld(node)).toEqual({ x: 265, y: 216 });
  });

  it('handles a negative pan offset', () => {
    const node = {
      getAbsolutePosition: () => ({ x: 100, y: 50 }),
      getStage: () => ({ x: () => -300, y: () => -200 }),
    };
    expect(absoluteToWorld(node)).toEqual({ x: 400, y: 250 });
  });
});
