import { useState, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export type Point = { x: number; y: number };

/**
 * Delay between the end of one stroke and recognition. A new stroke started
 * within this window is appended to the series instead of triggering
 * recognition, giving the user time to draw multi-stroke shapes.
 */
export const STROKE_DELAY_MS = 1500;

export function useGestureDraw(
  containerRef: RefObject<HTMLDivElement | null>,
  active: boolean,
  onComplete: (strokes: Point[][]) => void,
  strokeDelayMs: number = STROKE_DELAY_MS
) {
  const [trail, setTrail] = useState<Point[]>([]);
  const drawingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const strokesRef = useRef<Point[][]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      pointsRef.current = [];
      strokesRef.current = [];
      drawingRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const getLocal = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const finish = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const strokes = strokesRef.current;
      strokesRef.current = [];
      pointsRef.current = [];
      setTrail([]);
      if (strokes.length > 0 && strokes.some((s) => s.length > 2)) {
        onComplete(strokes);
      }
    };

    const scheduleFinish = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(finish, strokeDelayMs);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      // A new stroke within the delay window continues the series.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      drawingRef.current = true;
      const p = getLocal(e);
      pointsRef.current = [p];
      strokesRef.current = [...strokesRef.current, pointsRef.current];
      setTrail(strokesRef.current.flat());
    };

    const onMove = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      const p = getLocal(e);
      pointsRef.current.push(p);
      setTrail(strokesRef.current.flat());
    };

    const onUp = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (pointsRef.current.length > 2) {
        scheduleFinish();
      } else {
        // Too short to count as a stroke; drop it from the series.
        strokesRef.current = strokesRef.current.slice(0, -1);
        pointsRef.current = [];
        setTrail(strokesRef.current.flat());
        if (strokesRef.current.length > 0) {
          scheduleFinish();
        }
      }
    };

    container.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      container.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [active, containerRef, onComplete, strokeDelayMs]);

  if (!active) return [];
  return trail;
}
