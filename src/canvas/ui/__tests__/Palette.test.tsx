import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Palette } from '../Palette';
import { lightTheme } from '../../../theme';

function setup(overrides: Partial<Parameters<typeof Palette>[0]> = {}) {
  const props = {
    theme: lightTheme,
    themeName: 'light' as const,
    isDrawMode: false,
    canUndo: true,
    canRedo: true,
    onToggleTheme: vi.fn(),
    onToggleMode: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onPalettePointerDown: vi.fn(),
    ...overrides,
  };
  render(<Palette {...props} />);
  return props;
}

describe('Palette', () => {
  it('renders palette items and control buttons', () => {
    setup();
    expect(screen.getByText(/🌙 Dark/)).toBeInTheDocument();
    expect(screen.getByText('Select ✋')).toBeInTheDocument();
    expect(screen.getByText('↶ Undo')).toBeInTheDocument();
    expect(screen.getByText('↷ Redo')).toBeInTheDocument();
    for (const label of ['Start/End', 'Action', 'Condition', 'I/O', 'For-loop', 'Link']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('toggles the theme', () => {
    const props = setup();
    fireEvent.pointerDown(screen.getByText(/🌙 Dark/));
    expect(props.onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('toggles draw mode', () => {
    const props = setup();
    fireEvent.pointerDown(screen.getByText('Select ✋'));
    expect(props.onToggleMode).toHaveBeenCalledTimes(1);
  });

  it('calls undo and redo', () => {
    const props = setup();
    fireEvent.pointerDown(screen.getByText('↶ Undo'));
    fireEvent.pointerDown(screen.getByText('↷ Redo'));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(props.onRedo).toHaveBeenCalledTimes(1);
  });

  it('starts a palette drag for a block type', () => {
    const props = setup();
    const handler = vi.mocked(props.onPalettePointerDown);
    fireEvent.pointerDown(screen.getByText('Action'));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][1]).toBe('action');
  });
});
