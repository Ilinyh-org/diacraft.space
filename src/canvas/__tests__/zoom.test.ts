import { describe, expect, it } from 'vitest';
import {
  clampStageScale,
  MAX_STAGE_SCALE,
  MIN_STAGE_SCALE,
} from '../utils/zoom';

describe('clampStageScale', () => {
  it('keeps scales inside the window unchanged', () => {
    expect(clampStageScale(0.5)).toBe(0.5);
    expect(clampStageScale(MAX_STAGE_SCALE)).toBe(MAX_STAGE_SCALE);
    expect(clampStageScale(MIN_STAGE_SCALE)).toBe(MIN_STAGE_SCALE);
  });

  it('clamps zoom-out below the minimum', () => {
    expect(clampStageScale(0.01)).toBe(MIN_STAGE_SCALE);
  });

  it('clamps above the default view scale', () => {
    expect(clampStageScale(2)).toBe(MAX_STAGE_SCALE);
  });

  it('falls back to the default for non-finite input', () => {
    expect(clampStageScale(Number.NaN)).toBe(MAX_STAGE_SCALE);
    expect(clampStageScale(Number.POSITIVE_INFINITY)).toBe(MAX_STAGE_SCALE);
  });
});
