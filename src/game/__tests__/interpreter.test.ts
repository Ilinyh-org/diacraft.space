import { describe, expect, it } from 'vitest';
import { runProgram, wallAhead } from '../types';
import type { Level } from '../types';
import { LEVELS } from '../levels';

const level: Level = LEVELS[0]; // linear-1: 5x1 corridor, start (0,0) → goal (3,0)

describe('runProgram', () => {
  it('wins when the robot reaches the goal', () => {
    const result = runProgram(level, [
      { kind: 'move' },
      { kind: 'move' },
      { kind: 'move' },
    ]);
    expect(result.status).toBe('win');
    expect(result.frames.at(-1)).toEqual({ x: 3, y: 0, dir: 1 });
  });

  it('misses when the robot stops short of the goal', () => {
    const result = runProgram(level, [{ kind: 'move' }]);
    expect(result.status).toBe('missed');
  });

  it('crashes when the robot walks into a wall', () => {
    const result = runProgram(level, [
      { kind: 'move' },
      { kind: 'move' },
      { kind: 'move' },
      { kind: 'move' },
      { kind: 'move' },
    ]);
    expect(result.status).toBe('crash');
  });

  it('records a frame per state change', () => {
    const result = runProgram(level, [
      { kind: 'move' },
      { kind: 'move' },
    ]);
    expect(result.frames.length).toBe(3);
  });

  it('executes repeat bodies', () => {
    const result = runProgram(level, [
      { kind: 'repeat', times: 3, body: [{ kind: 'move' }] },
    ]);
    expect(result.status).toBe('win');
    expect(result.steps).toBe(4);
  });

  it('executes the ifWall branch when a wall is ahead', () => {
    const corner: Level = LEVELS[2]; // conditions-1
    const result = runProgram(corner, [
      { kind: 'move' },
      {
        kind: 'ifWall',
        then: [{ kind: 'turnRight' }, { kind: 'move' }, { kind: 'turnLeft' }, { kind: 'move' }],
        else: [],
      },
    ]);
    expect(result.status).toBe('win');
  });

  it('executes the else branch when no wall is ahead', () => {
    const result = runProgram(level, [
      {
        kind: 'ifWall',
        then: [],
        else: [{ kind: 'move' }, { kind: 'move' }, { kind: 'move' }],
      },
    ]);
    expect(result.status).toBe('win');
  });

  it('times out runaway programs', () => {
    const result = runProgram(level, [
      { kind: 'repeat', times: 999, body: [{ kind: 'repeat', times: 999, body: [{ kind: 'move' }] }] },
    ]);
    expect(result.status).toBe('crash');
  });

  it('handles empty programs', () => {
    const result = runProgram(level, []);
    expect(result.status).toBe('missed');
    expect(result.steps).toBe(0);
  });
});

describe('wallAhead', () => {
  it('detects a wall in front of the robot', () => {
    const corner: Level = LEVELS[2];
    expect(wallAhead(corner, { x: 1, y: 0, dir: 1 })).toBe(true);
    expect(wallAhead(corner, { x: 1, y: 0, dir: 2 })).toBe(false);
  });
});
