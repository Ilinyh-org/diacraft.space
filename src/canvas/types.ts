import type { BlockType, Side } from './Blocks/Block';
import type { Waypoint } from './Arrows/arrowPath';

export type BlockData = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  type: BlockType;
  initialRotation?: number;
};

export type ArrowData = {
  id: string;
  fromBlockId: string;
  fromSide: Side;
  toBlockId: string;
  toSide: Side;
  waypoints: Waypoint[];
};

export type DiagramState = {
  blocks: BlockData[];
  arrows: ArrowData[];
};
