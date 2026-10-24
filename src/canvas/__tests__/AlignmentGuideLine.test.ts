import { describe, expect, it } from 'vitest';
import { guideLinePoints } from '../AlignmentGuideLine';
import type { AlignmentGuide } from '../utils/alignment';

const vertical: AlignmentGuide = {
  axis: 'vertical',
  position: 60,
  from: 225,
  to: 25,
  targetId: 'b',
};

const horizontal: AlignmentGuide = {
  axis: 'horizontal',
  position: 30,
  from: 10,
  to: 200,
  targetId: 'b',
};

describe('guideLinePoints', () => {
  it('builds a vertical line spanning both block centers', () => {
    expect(guideLinePoints(vertical)).toEqual([60, 25, 60, 225]);
  });

  it('builds a horizontal line spanning both block centers', () => {
    expect(guideLinePoints(horizontal)).toEqual([10, 30, 200, 30]);
  });
});
