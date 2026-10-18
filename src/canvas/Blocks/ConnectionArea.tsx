import { Circle } from 'react-konva';
import { useEffect, useLayoutEffect, useRef } from 'react';
import Konva from 'konva';
import type { Theme } from '../../theme';

/** Radius of the animated dashed connection area marker. */
export const CONNECTION_AREA_RADIUS = 18;

/**
 * Animated connection area indicator shown at a block side anchor while
 * another block's connection handle is being dragged nearby.
 *
 * Renders as a dashed circle whose dash offset rotates continuously, with
 * fade-in / fade-out animations driven by the `visible` prop.
 */
export function ConnectionArea({
  x,
  y,
  theme,
  visible,
}: {
  x: number;
  y: number;
  theme: Theme;
  visible: boolean;
}) {
  const ref = useRef<Konva.Circle>(null);

  // Start hidden; the `visible` effect below animates the fade.
  useLayoutEffect(() => {
    ref.current?.opacity(0);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.to({
      opacity: visible ? 1 : 0,
      duration: 0.18,
      easing: visible ? Konva.Easings.EaseOut : Konva.Easings.EaseIn,
    });
  }, [visible]);

  // Continuous rotation of the dotted outline while mounted.
  useEffect(() => {
    const node = ref.current;
    const layer = node?.getLayer();
    if (!node || !layer) return;
    const anim = new Konva.Animation((frame) => {
      if (frame) node.dashOffset(-frame.time / 20);
    }, layer);
    anim.start();
    return () => {
      anim.stop();
    };
  }, []);

  return (
    <Circle
      ref={ref}
      x={x}
      y={y}
      radius={CONNECTION_AREA_RADIUS}
      stroke={theme.selection}
      strokeWidth={2}
      dash={[6, 6]}
      opacity={0}
      listening={false}
    />
  );
}
