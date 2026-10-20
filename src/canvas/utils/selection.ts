/** Selection state shared by Canvas block-selection handlers. */
export type SelectionState = {
  selectedIds: string[];
  selectedId: string | null;
};

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
 * Selection after right-clicking a block: keep an existing multi-selection
 * that already contains the block, otherwise select just that block.
 */
export function contextMenuSelection(
  prevIds: string[],
  prevId: string | null,
  id: string
): SelectionState {
  if (prevIds.includes(id)) return { selectedIds: prevIds, selectedId: prevId };
  return { selectedIds: [id], selectedId: id };
}
