import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboard } from '../useKeyboard';

function press(key: string, extra: Partial<KeyboardEvent> = {}) {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key, cancelable: true, ...extra }),
    );
  });
}

function setup(overrides: Partial<Parameters<typeof useKeyboard>[0]> = {}) {
  const options = {
    editingId: null,
    selectedId: null,
    selectedArrowId: null,
    onCommitEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onDeleteBlock: vi.fn(),
    onDeleteArrow: vi.fn(),
    onCopy: vi.fn(),
    onCut: vi.fn(),
    onPaste: vi.fn(),
    ...overrides,
  };
  renderHook(() => useKeyboard(options));
  return options;
}

describe('useKeyboard', () => {
  it('undo: ctrl+z', () => {
    const o = setup();
    press('z', { ctrlKey: true });
    expect(o.onUndo).toHaveBeenCalledTimes(1);
    expect(o.onRedo).not.toHaveBeenCalled();
  });

  it('undo: meta+z (macOS)', () => {
    const o = setup();
    press('z', { metaKey: true });
    expect(o.onUndo).toHaveBeenCalledTimes(1);
  });

  it('redo: ctrl+shift+z', () => {
    const o = setup();
    press('z', { ctrlKey: true, shiftKey: true });
    expect(o.onRedo).toHaveBeenCalledTimes(1);
    expect(o.onUndo).not.toHaveBeenCalled();
  });

  it('redo: ctrl+y', () => {
    const o = setup();
    press('y', { ctrlKey: true });
    expect(o.onRedo).toHaveBeenCalledTimes(1);
  });

  it('deletes the selected block with Delete', () => {
    const o = setup({ selectedId: 'b1' });
    press('Delete');
    expect(o.onDeleteBlock).toHaveBeenCalledWith('b1');
    expect(o.onDeleteArrow).not.toHaveBeenCalled();
  });

  it('deletes the selected arrow with Backspace when no block is selected', () => {
    const o = setup({ selectedArrowId: 'a1' });
    press('Backspace');
    expect(o.onDeleteArrow).toHaveBeenCalledWith('a1');
    expect(o.onDeleteBlock).not.toHaveBeenCalled();
  });

  it('does nothing on Delete without a selection', () => {
    const o = setup();
    press('Delete');
    expect(o.onDeleteBlock).not.toHaveBeenCalled();
    expect(o.onDeleteArrow).not.toHaveBeenCalled();
  });

  it('commit edit on Enter while editing', () => {
    const o = setup({ editingId: 'b1' });
    press('Enter');
    expect(o.onCommitEdit).toHaveBeenCalledTimes(1);
  });

  it('shift+Enter while editing inserts a newline instead of committing', () => {
    const o = setup({ editingId: 'b1' });
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(o.onCommitEdit).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('cancel edit on Escape while editing', () => {
    const o = setup({ editingId: 'b1' });
    press('Escape');
    expect(o.onCancelEdit).toHaveBeenCalledTimes(1);
  });

  it('ignores undo/delete shortcuts while editing', () => {
    const o = setup({ editingId: 'b1' });
    press('z', { ctrlKey: true });
    press('Delete');
    expect(o.onUndo).not.toHaveBeenCalled();
    expect(o.onDeleteBlock).not.toHaveBeenCalled();
  });

  it('copies with ctrl+c', () => {
    const o = setup();
    press('c', { ctrlKey: true });
    expect(o.onCopy).toHaveBeenCalledTimes(1);
  });

  it('copies with meta+c (macOS)', () => {
    const o = setup();
    press('c', { metaKey: true });
    expect(o.onCopy).toHaveBeenCalledTimes(1);
  });

  it('cuts with ctrl+x', () => {
    const o = setup();
    press('x', { ctrlKey: true });
    expect(o.onCut).toHaveBeenCalledTimes(1);
  });

  it('pastes with ctrl+v', () => {
    const o = setup();
    press('v', { ctrlKey: true });
    expect(o.onPaste).toHaveBeenCalledTimes(1);
  });

  it('ignores copy/paste shortcuts while editing', () => {
    const o = setup({ editingId: 'b1' });
    press('c', { ctrlKey: true });
    press('v', { ctrlKey: true });
    expect(o.onCopy).not.toHaveBeenCalled();
    expect(o.onPaste).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', () => {
    const onUndo = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboard({
        editingId: null,
        selectedId: null,
        selectedArrowId: null,
        onCommitEdit: vi.fn(),
        onCancelEdit: vi.fn(),
        onUndo,
        onRedo: vi.fn(),
        onDeleteBlock: vi.fn(),
        onDeleteArrow: vi.fn(),
        onCopy: vi.fn(),
        onCut: vi.fn(),
        onPaste: vi.fn(),
      }),
    );
    unmount();
    press('z', { ctrlKey: true });
    expect(onUndo).not.toHaveBeenCalled();
  });
});
