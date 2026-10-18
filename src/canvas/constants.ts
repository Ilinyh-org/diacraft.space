import type { BlockType } from './Blocks/Block';

export const GRID_SIZE = 20;
export const BLOCK_WIDTH = 120;
export const BLOCK_HEIGHT = 60;
export const EXPORT_PADDING = 20;
export const GRID_EXTENT = 5000;

export const PALETTE: { type: BlockType; label: string }[] = [
  { type: 'start', label: 'Start' },
  { type: 'action', label: 'Action' },
  { type: 'condition', label: 'Condition' },
  { type: 'io', label: 'I/O' },
  { type: 'forloop', label: 'For-loop' },
  { type: 'function', label: 'Function' },
  { type: 'link', label: 'Link' },
];

export const LABEL_BY_TYPE: Record<BlockType, string> = {
  start: 'Start',
  action: 'Action',
  condition: 'Condition',
  io: 'I/O',
  forloop: 'For-loop',
  function: 'Function',
  link: 'Link',
};
