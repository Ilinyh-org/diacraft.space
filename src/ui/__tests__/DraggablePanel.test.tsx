import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DraggablePanel } from '../DraggablePanel';
import { lightTheme } from '../../theme';

describe('DraggablePanel', () => {
  it('renders children at the initial position', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 20, y: 30 }}>
        <div>content</div>
      </DraggablePanel>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
    const panel = screen.getByText('content').parentElement!.parentElement!;
    expect(panel.style.left).toBe('20px');
    expect(panel.style.top).toBe('30px');
  });

  it('moves the panel when the handle is dragged', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 0, y: 0 }}>
        <div>content</div>
      </DraggablePanel>,
    );
    const handle = screen.getByText('content').parentElement!.parentElement!
      .firstElementChild!;
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 60, clientY: 40 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    const panel = screen.getByText('content').parentElement!.parentElement!;
    expect(panel.style.left).toBe('50px');
    expect(panel.style.top).toBe('30px');
  });

  it('stops dragging on pointer up so later moves have no effect', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 0, y: 0 }}>
        <div>content</div>
      </DraggablePanel>,
    );
    const handle = screen.getByText('content').parentElement!.parentElement!
      .firstElementChild!;
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 100 });

    const panel = screen.getByText('content').parentElement!.parentElement!;
    expect(panel.style.left).toBe('0px');
    expect(panel.style.top).toBe('0px');
  });
});
