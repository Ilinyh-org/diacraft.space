import { describe, it, expect } from 'vitest';
import { gestureToBlock } from '../gestureToBlock';
import type { Point } from '../normalize';

function rectPoints(x: number, y: number, w: number, h: number): Point[] {
  const pts: Point[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) pts.push({ x: x + (w * i) / steps, y });
  for (let i = 0; i <= steps; i++)
    pts.push({ x: x + w, y: y + (h * i) / steps });
  for (let i = 0; i <= steps; i++)
    pts.push({ x: x + w - (w * i) / steps, y: y + h });
  for (let i = 0; i <= steps; i++)
    pts.push({ x, y: y + h - (h * i) / steps });
  pts.push({ x, y });
  return pts;
}

function linePoints(x: number, y1: number, y2: number): Point[] {
  const pts: Point[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    pts.push({ x, y: y1 + ((y2 - y1) * i) / steps });
  }
  return pts;
}

describe('gestureToBlock', () => {
  it('does not classify a plain single-stroke rectangle as a function block', () => {
    const result = gestureToBlock([rectPoints(0, 0, 120, 70)]);
    expect(result === null || result.type !== 'function').toBe(true);
  });

  it('recognizes a rectangle with two inner vertical strokes as a function block', () => {
    const strokes = [
      rectPoints(0, 0, 120, 70),
      linePoints(25, 5, 65),
      linePoints(95, 5, 65),
    ];
    const result = gestureToBlock(strokes);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('function');
  });

  it('recognizes a function block regardless of inner stroke order', () => {
    const strokes = [
      rectPoints(0, 0, 120, 70),
      linePoints(95, 5, 65),
      linePoints(25, 5, 65),
    ];
    const result = gestureToBlock(strokes);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('function');
  });

  it('returns null for a non-closed first stroke', () => {
    const open: Point[] = [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 70 },
    ];
    const result = gestureToBlock([open]);
    expect(result).toBeNull();
  });

  it('returns null for an empty gesture', () => {
    expect(gestureToBlock([])).toBeNull();
  });
});
