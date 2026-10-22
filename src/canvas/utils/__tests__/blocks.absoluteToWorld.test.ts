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

  // Issue #82: with a zoomed-out stage the transform includes scale, so the
  // pan offset must be removed AND the result divided by the stage scale.
  describe('with a scaled stage (issue #82)', () => {
    it('divides by the stage scale after removing the pan offset', () => {
      const node = {
        getAbsolutePosition: () => ({ x: 50 + 2 * 30, y: 20 + 2 * 40 }),
        getStage: () => ({
          x: () => 50,
          y: () => 20,
          scaleX: () => 2,
        }),
      };
      expect(absoluteToWorld(node)).toEqual({ x: 30, y: 40 });
    });

    it('treats a zoomed-out scale (0.5) correctly', () => {
      const node = {
        getAbsolutePosition: () => ({ x: 100 + 0.5 * 120, y: 0 + 0.5 * -80 }),
        getStage: () => ({
          x: () => 100,
          y: () => 0,
          scaleX: () => 0.5,
        }),
      };
      expect(absoluteToWorld(node)).toEqual({ x: 120, y: -80 });
    });

    it('defaults to scale 1 when the stage does not report scaleX', () => {
      const node = {
        getAbsolutePosition: () => ({ x: 105, y: 205 }),
        getStage: () => ({ x: () => 5, y: () => 5 }),
      };
      expect(absoluteToWorld(node)).toEqual({ x: 100, y: 200 });
    });
  });
});
