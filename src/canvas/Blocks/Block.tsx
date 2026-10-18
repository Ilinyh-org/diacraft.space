import {
  Rect,
  Text,
  Group,
  Line,
  Ellipse,
  Circle,
} from 'react-konva';
import { useLayoutEffect, useRef, useEffect, useState } from 'react';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Theme } from '../../theme';

export type BlockType =
  | 'action'
  | 'condition'
  | 'io'
  | 'forloop'
  | 'start'
  | 'link';

export type Side = 'top' | 'right' | 'bottom' | 'left';

const MIN_WIDTH = 60;
const MIN_HEIGHT = 40;
const HANDLE_RADIUS = 6;
const RESIZE_HANDLE_SIZE = 16;

type BlockProps = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  type?: BlockType;
  selected?: boolean;
  removing?: boolean;
  theme: Theme;
  onDragStart?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  onDragMove?: (x: number, y: number) => void;
  onSelect?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onResize?: (w: number, h: number) => void;
  onHandleDragStart?: (side: Side, x: number, y: number) => void;
  onHandleDragMove?: (x: number, y: number) => void;
  onHandleDragEnd?: (x: number, y: number) => void;
  onRemoved?: () => void;
};

export function Block({
  x,
  y,
  width = 120,
  height = 60,
  label = 'Action',
  type = 'action',
  selected = false,
  removing = false,
  theme,
  onDragStart,
  onDragEnd,
  onDragMove,
  onSelect,
  onDelete,
  onEdit,
  onResize,
  onHandleDragStart,
  onHandleDragMove,
  onHandleDragEnd,
  onRemoved,
}: BlockProps) {
  const contentRef = useRef<Konva.Group>(null);
  const spawnDoneRef = useRef(false);
  const removeStartedRef = useRef(false);

  const [prevSize, setPrevSize] = useState({ w: width, h: height });
  const [liveSize, setLiveSize] = useState({ w: width, h: height });

  if (width !== prevSize.w || height !== prevSize.h) {
    setPrevSize({ w: width, h: height });
    setLiveSize({ w: width, h: height });
  }

  const w = liveSize.w;
  const h = liveSize.h;

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    node.scale({ x: 0.2, y: 0.2 });
    node.opacity(0);
    node.to({
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      duration: 0.3,
      easing: Konva.Easings.BackEaseOut,
      onFinish: () => {
        spawnDoneRef.current = true;
      },
    });
  }, []);

  useEffect(() => {
    if (!removing) return;
    const node = contentRef.current;
    if (!node) return;
    if (removeStartedRef.current) return;
    removeStartedRef.current = true;

    const startRemove = () => {
      node.to({
        scaleX: 0.2,
        scaleY: 0.2,
        opacity: 0,
        duration: 0.25,
        easing: Konva.Easings.EaseIn,
        onFinish: () => {
          onRemoved?.();
        },
      });
    };

    if (spawnDoneRef.current) {
      startRemove();
    } else {
      const t = setTimeout(startRemove, 300);
      return () => clearTimeout(t);
    }
  }, [removing, onRemoved]);

  const stroke = selected ? theme.selection : theme.blockStroke;
  const strokeWidth = selected ? 3 : 2;
  const fill = theme.blockFill;

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    onDragEnd?.(e.target.x(), e.target.y());
  };

  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    onDragMove?.(e.target.x(), e.target.y());
  };

  const handleClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    onSelect?.();
  };

  const handleLabelDblClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    onEdit?.();
  };

  const renderShape = () => {
    switch (type) {
      case 'action':
        return (
          <Rect
            width={w}
            height={h}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            cornerRadius={6}
          />
        );

      case 'condition':
        return (
          <Line
            points={[w / 2, 0, w, h / 2, w / 2, h, 0, h / 2]}
            closed
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'io':
        return (
          <Line
            points={[w * 0.2, 0, w, 0, w * 0.8, h, 0, h]}
            closed
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'forloop':
        return (
          <Line
            points={[
              w * 0.25,
              0,
              w * 0.75,
              0,
              w,
              h / 2,
              w * 0.75,
              h,
              w * 0.25,
              h,
              0,
              h / 2,
            ]}
            closed
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'start':
        return (
          <Ellipse
            x={w / 2}
            y={h / 2}
            radiusX={w / 2}
            radiusY={h / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case 'link':
        return (
          <Circle
            x={w / 2}
            y={h / 2}
            radius={Math.min(w, h) / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      default:
        return null;
    }
  };

  const sides: { side: Side; hx: number; hy: number }[] = [
    { side: 'top', hx: w / 2, hy: 0 },
    { side: 'right', hx: w, hy: h / 2 },
    { side: 'bottom', hx: w / 2, hy: h },
    { side: 'left', hx: 0, hy: h / 2 },
  ];

  return (
    <Group>
      <Group
        x={x}
        y={y}
        draggable={!removing}
        onDragStart={onDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onClick={removing ? undefined : handleClick}
        onTap={removing ? undefined : handleClick}
      >
        <Group
          ref={contentRef}
          offsetX={w / 2}
          offsetY={h / 2}
          x={w / 2}
          y={h / 2}
        >
          {renderShape()}
          <Text
            text={label}
            width={w}
            height={h}
            align="center"
            verticalAlign="middle"
            fontSize={14}
            fill={theme.blockText}
            listening={!removing}
            onDblClick={handleLabelDblClick}
            onDblTap={handleLabelDblClick}
          />
        </Group>
      </Group>

      {selected &&
        !removing &&
        sides.map(({ side, hx, hy }) => (
          <Circle
            key={side}
            x={x + hx}
            y={y + hy}
            radius={HANDLE_RADIUS}
            fill={theme.selection}
            stroke="#ffffff"
            strokeWidth={2}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
              const abs = e.target.getAbsolutePosition();
              onHandleDragStart?.(side, abs.x, abs.y);
            }}
            onDragMove={(e) => {
              const abs = e.target.getAbsolutePosition();
              onHandleDragMove?.(abs.x, abs.y);
            }}
            onDragEnd={(e) => {
              const abs = e.target.getAbsolutePosition();
              onHandleDragEnd?.(abs.x, abs.y);
            }}
          />
        ))}

      {selected && !removing && (
        <Group
          x={x + w + 10}
          y={y - 10}
          onClick={(e) => {
            e.cancelBubble = true;
            onDelete?.();
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDelete?.();
          }}
        >
          <Circle
            radius={11}
            fill={theme.deleteButton}
            stroke="#ffffff"
            strokeWidth={2}
          />
          <Text
            text="✕"
            x={-11}
            y={-11}
            width={22}
            height={22}
            align="center"
            verticalAlign="middle"
            fontSize={14}
            fill="#ffffff"
            listening={false}
          />
        </Group>
      )}

      {selected && !removing && (
        <Group
          x={x + w + 10}
          y={y + 14}
          onClick={(e) => {
            e.cancelBubble = true;
            onEdit?.();
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onEdit?.();
          }}
        >
          <Circle
            radius={11}
            fill={theme.editButton}
            stroke="#ffffff"
            strokeWidth={2}
          />
          <Text
            text="✎"
            x={-11}
            y={-11}
            width={22}
            height={22}
            align="center"
            verticalAlign="middle"
            fontSize={14}
            fill="#ffffff"
            listening={false}
          />
        </Group>
      )}

      {selected && !removing && (
        <Rect
          x={x + w - RESIZE_HANDLE_SIZE / 2}
          y={y + h - RESIZE_HANDLE_SIZE / 2}
          width={RESIZE_HANDLE_SIZE}
          height={RESIZE_HANDLE_SIZE}
          fill={theme.selection}
          stroke="#ffffff"
          strokeWidth={2}
          cornerRadius={3}
          draggable
          onDragStart={(e) => {
            e.cancelBubble = true;
          }}
          dragBoundFunc={(pos) => {
            const desiredCornerX = pos.x + RESIZE_HANDLE_SIZE / 2;
            const desiredCornerY = pos.y + RESIZE_HANDLE_SIZE / 2;
            const newW = Math.max(MIN_WIDTH, desiredCornerX - x);
            const newH = Math.max(MIN_HEIGHT, desiredCornerY - y);
            setLiveSize({ w: newW, h: newH });
            return {
              x: x + newW - RESIZE_HANDLE_SIZE / 2,
              y: y + newH - RESIZE_HANDLE_SIZE / 2,
            };
          }}
          onDragEnd={(e) => {
            const desiredCornerX = e.target.x() + RESIZE_HANDLE_SIZE / 2;
            const desiredCornerY = e.target.y() + RESIZE_HANDLE_SIZE / 2;
            const newW = Math.max(MIN_WIDTH, desiredCornerX - x);
            const newH = Math.max(MIN_HEIGHT, desiredCornerY - y);
            onResize?.(newW, newH);
          }}
        />
      )}
    </Group>
  );
}
