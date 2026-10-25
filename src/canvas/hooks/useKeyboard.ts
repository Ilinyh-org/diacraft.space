import { useEffect } from 'react';

type Options = {
  editingId: string | null;
  selectedId: string | null;
  selectedArrowId: string | null;
  selectedArrowIds: string[];
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteBlock: (id: string) => void;
  onDeleteArrow: (id: string) => void;
  /** Delete everything currently selected (issue #133 multi-selection). */
  onDeleteSelection: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
};

export function useKeyboard({
  editingId,
  selectedId,
  selectedArrowId,
  selectedArrowIds,
  onCommitEdit,
  onCancelEdit,
  onUndo,
  onRedo,
  onDeleteBlock,
  onDeleteArrow,
  onDeleteSelection,
  onCopy,
  onCut,
  onPaste,
}: Options) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingId) {
        if (e.key === 'Enter') {
          // Shift+Enter inserts a newline in the edit input (issue #95);
          // on touch devices the keyboard's ↵ key does the same, and the
          // edit is committed by tapping outside (blur). Let the native
          // textarea handle both.
          const isTouchDevice =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(pointer: coarse)').matches;
          if (e.shiftKey || isTouchDevice) return;
          e.preventDefault();
          onCommitEdit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancelEdit();
        }
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Issue #104: when the user is typing in a text input (game panel,
      // export panel, algorithm panel, etc.) the canvas clipboard and
      // editing hotkeys must not fire — the native text editing takes
      // precedence. The block-label edit input is handled above via the
      // editingId branch.
      const target = e.target as HTMLElement | null;
      const isEditableTarget =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditableTarget) return;

      if (mod && key === 'c') {
        e.preventDefault();
        onCopy();
        return;
      }
      if (mod && key === 'x') {
        e.preventDefault();
        onCut();
        return;
      }
      if (mod && key === 'v') {
        e.preventDefault();
        onPaste();
        return;
      }

      const isUndo = mod && key === 'z' && !e.shiftKey;
      const isRedo =
        mod && (key === 'y' || (key === 'z' && e.shiftKey));

      if (isUndo) {
        e.preventDefault();
        onUndo();
        return;
      }
      if (isRedo) {
        e.preventDefault();
        onRedo();
        return;
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      // Issue #133: a ctrl-selected arrow group (possibly mixed with blocks)
      // is deleted as a whole via onDeleteSelection.
      if (selectedArrowIds.length > 0) {
        e.preventDefault();
        onDeleteSelection();
        return;
      }
      if (selectedId) {
        e.preventDefault();
        onDeleteBlock(selectedId);
        return;
      }
      if (selectedArrowId) {
        e.preventDefault();
        onDeleteArrow(selectedArrowId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    editingId,
    selectedId,
    selectedArrowId,
    selectedArrowIds,
    onCommitEdit,
    onCancelEdit,
    onUndo,
    onRedo,
    onDeleteBlock,
    onDeleteArrow,
    onDeleteSelection,
    onCopy,
    onCut,
    onPaste,
  ]);
}
