import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from '../ContextMenu';
import { getTheme } from '../../../theme';

const theme = getTheme('light');

describe('ContextMenu', () => {
  it('renders the given items', () => {
    render(
      <ContextMenu
        theme={theme}
        x={10}
        y={10}
        items={[
          { label: 'Copy', onSelect: vi.fn() },
          { label: 'Paste', disabled: true, onSelect: vi.fn() },
        ]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Copy')).toBeTruthy();
    const paste = screen.getByText('Paste') as HTMLButtonElement;
    expect(paste.disabled).toBe(true);
  });

  it('invokes the item handler and closes after a click', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu
        theme={theme}
        x={10}
        y={10}
        items={[{ label: 'Copy', onSelect }]}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByText('Copy'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on outside pointer down', () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        theme={theme}
        x={10}
        y={10}
        items={[{ label: 'Paste', onSelect: vi.fn() }]}
        onClose={onClose}
      />
    );
    fireEvent.pointerDown(window, { target: document.body });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        theme={theme}
        x={10}
        y={10}
        items={[{ label: 'Paste', onSelect: vi.fn() }]}
        onClose={onClose}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
