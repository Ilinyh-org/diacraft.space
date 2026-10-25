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
