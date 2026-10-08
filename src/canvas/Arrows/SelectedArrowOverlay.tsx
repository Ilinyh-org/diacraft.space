import { Circle, Text, Group } from 'react-konva';
import type { ArrowData, BlockData } from '../types';
import type { Theme } from '../../theme';
import { getAnchor } from '../utils/blocks';
import { buildArrowPath, pathMidpoint } from './arrowPath';

type Props = {
  arrow: ArrowData;
  blocks: BlockData[];
  theme: Theme;
  onAddWaypoint: (x: number, y: number) => void;
  onDeleteArrow: () => void;
  onBendDragEnd: (idx: number, x: number, y: number) => void;
  onBendDelete: (idx: number) => void;
};

export function SelectedArrowOverlay({
  arrow,
  blocks,
  theme,
  onAddWaypoint,
  onDeleteArrow,
  onBendDragEnd,
  onBendDelete,
}: Props) {
  const from = blocks.find((b) => b.id === arrow.fromBlockId);
  const to = blocks.find((b) => b.id === arrow.toBlockId);
  if (!from || !to) return null;
  const a = getAnchor(from, arrow.fromSide);
  const b = getAnchor(to, arrow.toSide);
  const pts = buildArrowPath(
    a,
    arrow.fromSide,
    b,
    arrow.toSide,
    arrow.waypoints
  );
  if (pts.length < 4) return null;
  const mid = pathMidpoint(pts);
  const bends = arrow.waypoints;

  return (
    <>
      <Group
        x={mid.x}
        y={mid.y - 26}
        onClick={(e) => {
          e.cancelBubble = true;
          onAddWaypoint(mid.x, mid.y);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onAddWaypoint(mid.x, mid.y);
        }}
      >
        <Circle
          radius={11}
          fill={theme.addButton}
          stroke="#ffffff"
          strokeWidth={2}
        />
        <Text
          text="+"
          x={-11}
          y={-11}
          width={22}
          height={22}
          align="center"
          verticalAlign="middle"
          fontSize={18}
          fill="#ffffff"
          listening={false}
        />
      </Group>

      <Group
        x={mid.x}
        y={mid.y + 26}
        onClick={(e) => {
          e.cancelBubble = true;
          onDeleteArrow();
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onDeleteArrow();
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

      {bends.map((bend, idx) => (
        <Group
          key={idx}
          x={bend.x}
          y={bend.y}
          draggable
          onDragStart={(e) => {
            e.cancelBubble = true;
          }}
          onDragEnd={(e) => {
            onBendDragEnd(idx, e.target.x(), e.target.y());
          }}
        >
          <Circle
            radius={7}
            fill={theme.selection}
            stroke="#ffffff"
            strokeWidth={2}
          />
          <Group
            x={15}
            y={-15}
            onClick={(e) => {
              e.cancelBubble = true;
              onBendDelete(idx);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onBendDelete(idx);
            }}
          >
            <Circle
              radius={7}
              fill={theme.deleteButton}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
            <Text
              text="✕"
              x={-7}
              y={-7}
              width={14}
              height={14}
              align="center"
              verticalAlign="middle"
              fontSize={10}
              fill="#ffffff"
              listening={false}
            />
          </Group>
        </Group>
      ))}
    </>
  );
}
