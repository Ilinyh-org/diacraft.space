import { Arrow } from 'react-konva';
import type { ArrowData, BlockData } from '../types';
import type { Theme } from '../../theme';
import { getAnchor } from '../utils/blocks';
import { buildArrowPath } from './arrowPath';

type Props = {
  arrow: ArrowData;
  blocks: BlockData[];
  theme: Theme;
  isSelected: boolean;
  isHighlighted?: boolean;
  listening: boolean;
  onClick: () => void;
};

export function ArrowShape({
  arrow,
  blocks,
  theme,
  isSelected,
  isHighlighted = false,
  listening,
  onClick,
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
  const color = isHighlighted
    ? theme.runHighlight
    : isSelected
      ? theme.arrowSelected
      : theme.arrow;
  return (
    <Arrow
      points={pts}
      stroke={color}
      fill={color}
      strokeWidth={isHighlighted || isSelected ? 3 : 2}
      pointerLength={10}
      pointerWidth={10}
      hitStrokeWidth={20}
      lineJoin="round"
      lineCap="round"
      listening={listening}
      onClick={(e) => {
        e.cancelBubble = true;
        onClick();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onClick();
      }}
    />
  );
}
