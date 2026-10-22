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
  /** Optional user label, e.g. yes/no on condition branches. */
  label?: string;
  waypoints: Waypoint[];
  /**
   * True once the user explicitly shaped the arrow (added/dragged/deleted a
   * bend). Non-customized arrows always re-route to a clean elbow when a
   * block moves; customized arrows only reset on a true double-back.
   */
  waypointsCustomized?: boolean;
};

export type DiagramState = {
  blocks: BlockData[];
  arrows: ArrowData[];
};
