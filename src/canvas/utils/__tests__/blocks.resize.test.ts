import { describe, expect, it } from 'vitest';
import { dragPosToWorld, worldToAbsolute } from '../blocks';

const stage = {
  x: () => 120,
  y: () => -40,
  scaleX: () => 2,
  scaleY: () => 2,
};

describe('resize handle stage-transform conversion (issue #144)', () => {
  it('converts an absolute drag position to world coordinates', () => {
    const world = dragPosToWorld({ x: 320, y: 60 }, stage);
    expect(world).toEqual({ x: 100, y: 50 });
  });

  it('is the inverse of worldToAbsolute', () => {
    const world = { x: 37, y: -12 };
    const roundTrip = dragPosToWorld(worldToAbsolute(world, stage), stage);
    expect(roundTrip.x).toBeCloseTo(world.x);
    expect(roundTrip.y).toBeCloseTo(world.y);
  });

  it('returns the input unchanged when there is no stage transform', () => {
    const pos = { x: 5, y: 7 };
    expect(dragPosToWorld(pos, null)).toEqual(pos);
    expect(worldToAbsolute(pos, null)).toEqual(pos);
  });
});
