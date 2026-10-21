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

  describe('different ways to draw existing blocks', () => {
    // Seeded pseudo-random generator so noisy gestures are deterministic.
    function noisy(points: Point[], amplitude: number, seed = 7): Point[] {
      let s = seed;
      const rand = () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648 - 0.5;
      };
      return points.map((pt) => ({
        x: pt.x + rand() * amplitude,
        y: pt.y + rand() * amplitude,
      }));
    }

    function diamondPoints(
      x: number,
      y: number,
      w: number,
      h: number
    ): Point[] {
      const corners = [
        { x: x + w / 2, y },
        { x: x + w, y: y + h / 2 },
        { x: x + w / 2, y: y + h },
        { x, y: y + h / 2 },
      ];
      const pts: Point[] = [];
      for (let i = 0; i <= corners.length; i++) {
        const a = corners[i % corners.length];
        const b = corners[(i + 1) % corners.length];
        const steps = 8;
        for (let j = 0; j < steps; j++) {
          pts.push({
            x: a.x + ((b.x - a.x) * j) / steps,
            y: a.y + ((b.y - a.y) * j) / steps,
          });
        }
      }
      pts.push({ x: x + w / 2, y });
      return pts;
    }

    function parallelogramPoints(
      x: number,
      y: number,
      w: number,
      h: number,
      lean: number
    ): Point[] {
      const corners = [
        { x: x + lean, y },
        { x: x + w + lean, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      const pts: Point[] = [];
      for (let i = 0; i <= corners.length; i++) {
        const a = corners[i % corners.length];
        const b = corners[(i + 1) % corners.length];
        const steps = 8;
        for (let j = 0; j < steps; j++) {
          pts.push({
            x: a.x + ((b.x - a.x) * j) / steps,
            y: a.y + ((b.y - a.y) * j) / steps,
          });
        }
      }
      pts.push({ x: x + lean, y });
      return pts;
    }

    function hexagonPoints(
      x: number,
      y: number,
      w: number,
      h: number
    ): Point[] {
      const corners = [
        { x: x + w * 0.25, y },
        { x: x + w * 0.75, y },
        { x: x + w, y: y + h / 2 },
        { x: x + w * 0.75, y: y + h },
        { x: x + w * 0.25, y: y + h },
        { x, y: y + h / 2 },
      ];
      const pts: Point[] = [];
      for (let i = 0; i <= corners.length; i++) {
        const a = corners[i % corners.length];
        const b = corners[(i + 1) % corners.length];
        const steps = 8;
        for (let j = 0; j < steps; j++) {
          pts.push({
            x: a.x + ((b.x - a.x) * j) / steps,
            y: a.y + ((b.y - a.y) * j) / steps,
          });
        }
      }
      pts.push({ x: x + w * 0.25, y });
      return pts;
    }

    function ellipsePoints(
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      reverse = false
    ): Point[] {
      const pts: Point[] = [];
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const t = ((reverse ? -i : i) / steps) * Math.PI * 2;
        pts.push({
          x: cx + rx * Math.cos(t),
          y: cy + ry * Math.sin(t),
        });
      }
      return pts;
    }

    function rotate(points: Point[], times: number): Point[] {
      // Rotate the drawing start point around the shape's vertex list.
      const result = points.slice();
      for (let i = 0; i < times; i++) {
        const quarter = Math.floor(result.length / 4);
        result.push(...result.splice(0, quarter));
      }
      return result;
    }

    it.each([
      ['drawn clockwise, large', rectPoints(0, 0, 160, 90)],
      ['drawn counter-clockwise', rectPoints(0, 0, 160, 90).slice().reverse()],
      ['drawn starting from bottom-left', rotate(rectPoints(0, 0, 150, 80), 2)],
      ['small rect', rectPoints(100, 100, 90, 55)],
      ['noisy rect', noisy(rectPoints(0, 0, 150, 85), 4)],
    ])('recognizes an action block %s', (_label, stroke) => {
      const result = gestureToBlock([stroke]);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('action');
    });

    it.each([
      ['square diamond', diamondPoints(0, 0, 140, 140)],
      ['wide diamond', diamondPoints(0, 0, 180, 90)],
      ['tall diamond', diamondPoints(0, 0, 90, 160)],
      ['reversed diamond', diamondPoints(0, 0, 140, 140).slice().reverse()],
      ['noisy diamond', noisy(diamondPoints(0, 0, 150, 120), 4)],
    ])('recognizes a condition block %s', (_label, stroke) => {
      const result = gestureToBlock([stroke]);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('condition');
    });

    it.each([
      ['leaning right', parallelogramPoints(0, 0, 160, 80, 25)],
      ['leaning left', parallelogramPoints(0, 0, 160, 80, -25)],
      ['reversed direction', parallelogramPoints(0, 0, 150, 75, 30).slice().reverse()],
      ['noisy parallelogram', noisy(parallelogramPoints(0, 0, 150, 80, 25), 4)],
    ])('recognizes an io block %s', (_label, stroke) => {
      const result = gestureToBlock([stroke]);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('io');
    });

    it.each([
      ['wide hexagon', hexagonPoints(0, 0, 170, 90)],
      ['square hexagon', hexagonPoints(0, 0, 120, 120)],
      ['reversed hexagon', hexagonPoints(0, 0, 170, 90).slice().reverse()],
      ['noisy hexagon', noisy(hexagonPoints(0, 0, 160, 90), 4)],
    ])('recognizes a forloop block %s', (_label, stroke) => {
      const result = gestureToBlock([stroke]);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('forloop');
    });

    it.each([
      ['circle clockwise', ellipsePoints(100, 100, 60, 60)],
      ['circle counter-clockwise', ellipsePoints(100, 100, 60, 60, true)],
      ['wide oval', ellipsePoints(120, 100, 80, 45)],
      ['noisy circle', noisy(ellipsePoints(100, 100, 60, 60), 3)],
    ])('recognizes a link/start ellipse %s', (_label, stroke) => {
      const result = gestureToBlock([stroke]);
      expect(result).not.toBeNull();
      expect(result!.score).toBeGreaterThanOrEqual(0.5);
    });

    it('rejects an ellipse drawn too tall to be any block', () => {
      const result = gestureToBlock([ellipsePoints(100, 100, 40, 80)]);
      expect(result).toBeNull();
    });
  });
});
