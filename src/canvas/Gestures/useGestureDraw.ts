import { useState, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export type Point = { x: number; y: number };

export function useGestureDraw(
  containerRef: RefObject<HTMLDivElement | null>,
  active: boolean,
  onComplete: (points: Point[]) => void
) {
  const [points, setPoints] = useState<Point[]>([]);
  const drawingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);

  useEffect(() => {
    if (!active) {
      pointsRef.current = [];
      drawingRef.current = false;
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const getLocal = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      drawingRef.current = true;
      const p = getLocal(e);
      pointsRef.current = [p];
      setPoints([p]);
    };

    const onMove = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      const p = getLocal(e);
      pointsRef.current.push(p);
      setPoints([...pointsRef.current]);
    };

    const onUp = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const done = pointsRef.current;
      pointsRef.current = [];
      setPoints([]);
      if (done.length > 2) onComplete(done);
    };

    container.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      container.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [active, containerRef, onComplete]);

  return active ? points : [];
}
