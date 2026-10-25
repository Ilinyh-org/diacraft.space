/** Selection state shared by Canvas block/arrow-selection handlers. */
export type SelectionState = {
  selectedIds: string[];
  selectedId: string | null;
};

/** Shared toggle logic for a multi-selectable id collection (issue #133). */
function toggleIdSelection(
  prevIds: string[],
  prevId: string | null,
  id: string,
  multi: boolean
): SelectionState {
  if (!multi) return { selectedIds: [id], selectedId: id };
  if (prevIds.includes(id)) {
    const selectedIds = prevIds.filter((b) => b !== id);
    const selectedId =
      prevId !== null && prevId !== id && selectedIds.includes(prevId)
        ? prevId
        : null;
    return { selectedIds, selectedId };
  }
  return { selectedIds: [...prevIds, id], selectedId: id };
}

/** A block id with an absolute canvas position. */
export type BlockPosition = { id: string; x: number; y: number };

export type PositionMap = Record<string, { x: number; y: number }>;

/**
 * Issue #138: given the positions captured at drag start for every selected
 * block, return the positions after moving the dragged block to (x, y) —
 * every block in the selection translates by the dragged block's delta.
 */
export function computeMultiDragPositions(
  startPositions: PositionMap,
  dragId: string,
  x: number,
  y: number
): PositionMap {
  const start = startPositions[dragId];
  if (!start) return {};
  const dx = x - start.x;
  const dy = y - start.y;
  const result: PositionMap = {};
  for (const [id, p] of Object.entries(startPositions)) {
    result[id] = { x: p.x + dx, y: p.y + dy };
  }
  return result;
}

/**
 * Toggle-select a block. Plain click selects only that block; ctrl/meta click
 * adds it to the selection, or removes it when already selected (deselecting
 * completely — the primary selection must not keep pointing at a removed id).
 */
export function toggleBlockSelection(
  prevIds: string[],
  prevId: string | null,
  id: string,
  multi: boolean
): SelectionState {
  return toggleIdSelection(prevIds, prevId, id, multi);
}

/**
 * Toggle-select an arrow (issue #133). Same semantics as block selection:
 * plain click selects only that arrow; ctrl/meta click adds it to the
 * selection, or removes it when already selected.
 */
export function toggleArrowSelection(
  prevIds: string[],
  prevId: string | null,
  id: string,
  multi: boolean
): SelectionState {
  return toggleIdSelection(prevIds, prevId, id, multi);
}
