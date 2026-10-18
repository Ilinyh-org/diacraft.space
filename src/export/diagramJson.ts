import type { ArrowData, BlockData, DiagramState } from '../canvas/types';
import type { Waypoint } from '../canvas/Arrows/arrowPath';

export const DIAGRAM_JSON_VERSION = 1;

export type DiagramJsonFile = {
  format: 'diacraft-diagram';
  version: number;
  blocks: BlockData[];
  arrows: ArrowData[];
};

function isPoint(p: unknown): p is Waypoint {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  return typeof obj.x === 'number' && typeof obj.y === 'number';
}

function isBlock(b: unknown): b is BlockData {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.x === 'number' &&
    typeof o.y === 'number' &&
    typeof o.width === 'number' &&
    typeof o.height === 'number' &&
    typeof o.label === 'string' &&
    typeof o.type === 'string'
  );
}

function isArrow(a: unknown): a is ArrowData {
  if (!a || typeof a !== 'object') return false;
  const o = a as Record<string, unknown>;
  const waypoints = o.waypoints;
  return (
    typeof o.id === 'string' &&
    typeof o.fromBlockId === 'string' &&
    typeof o.fromSide === 'string' &&
    typeof o.toBlockId === 'string' &&
    typeof o.toSide === 'string' &&
    (waypoints === undefined ||
      (Array.isArray(waypoints) && waypoints.every(isPoint)))
  );
}

/**
 * Serializes a diagram state into the portable JSON format.
 * Arrows referencing missing blocks are dropped so the file stays consistent.
 */
export function serializeDiagram(state: DiagramState): DiagramJsonFile {
  const blocks = state.blocks;
  const blockIds = new Set(blocks.map((b) => b.id));
  const arrows = state.arrows.filter(
    (a) => blockIds.has(a.fromBlockId) && blockIds.has(a.toBlockId)
  );
  return {
    format: 'diacraft-diagram',
    version: DIAGRAM_JSON_VERSION,
    blocks,
    arrows,
  };
}

export function exportDiagram(state: DiagramState): string {
  return JSON.stringify(serializeDiagram(state), null, 2);
}

/**
 * Parses and validates a diagram JSON string.
 * Throws Error with a readable message when the content is not a valid
 * diagram file; arrows referencing missing blocks are dropped.
 */
export function parseDiagram(json: string): DiagramState {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON file');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Not a diagram file');
  }
  const o = data as Record<string, unknown>;
  if (o.format !== 'diacraft-diagram') {
    throw new Error('Not a diacraft diagram file');
  }
  if (!Array.isArray(o.blocks) || !Array.isArray(o.arrows)) {
    throw new Error('Diagram file is missing blocks or arrows');
  }
  const blocks = o.blocks.filter(isBlock);
  const blockIds = new Set(blocks.map((b) => b.id));
  const arrows = (o.arrows as unknown[])
    .filter(isArrow)
    .filter((a) => blockIds.has(a.fromBlockId) && blockIds.has(a.toBlockId))
    .map((a) => ({ ...a, waypoints: a.waypoints ?? [] }));
  return { blocks, arrows };
}

export function downloadDiagramJson(state: DiagramState) {
  const a = document.createElement('a');
  a.href =
    'data:application/json;charset=utf-8,' +
    encodeURIComponent(exportDiagram(state));
  a.download = 'diagram.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
