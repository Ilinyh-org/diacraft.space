import { useEffect, useRef } from 'react';
import { Line } from 'react-konva';
import type Konva from 'konva';
import type { AlignmentGuide } from './utils/alignment';

/**
 * Issue #116 (rework): the alignment guide line is drawn IN FRONT of the
 * blocks (rendered after them in the same layer) and its dashes are
 * animated, marching along the line while the guide is visible.
 */

export const GUIDE_DASH_PATTERN = [6, 4];
const GUIDE_DASH_SPEED = 20; // px per second along the line

export function guideLinePoints(guide: AlignmentGuide): number[] {
  return guide.axis === 'vertical'
    ? [
        guide.position,
        Math.min(guide.from, guide.to),
        guide.position,
        Math.max(guide.from, guide.to),
      ]
    : [
        Math.min(guide.from, guide.to),
        guide.position,
        Math.max(guide.from, guide.to),
        guide.position,
      ];
}

export function AlignmentGuideLine({ guide }: { guide: AlignmentGuide }) {
  const lineRef = useRef<Konva.Line | null>(null);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let offset = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      offset = (offset + GUIDE_DASH_SPEED * dt) % 10; // dash period = 6+4
      const node = lineRef.current;
      if (node) {
        node.dashOffset(offset);
        node.getLayer()?.batchDraw();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Line
      ref={lineRef}
      points={guideLinePoints(guide)}
      stroke="#2f7cf6"
      strokeWidth={1.5}
      dash={GUIDE_DASH_PATTERN}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}
