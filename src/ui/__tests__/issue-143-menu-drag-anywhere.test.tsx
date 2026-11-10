import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DraggablePanel } from '../DraggablePanel';
import { lightTheme } from '../../theme';

const getPanel = () => screen.getByText('content').parentElement!.parentElement!;

const drag = (from: HTMLElement, dx: number, dy: number) => {
  fireEvent.pointerDown(from, { clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.pointerMove(from, { clientX: 10 + dx, clientY: 10 + dy });
  fireEvent.pointerUp(from, { pointerId: 1 });
};

describe('issue #143: dragging from any empty space of the menu', () => {
  it('moves the panel when dragging from the content wrapper (empty space)', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 0, y: 0 }}>
        <div>content</div>
      </DraggablePanel>,
    );
    const panel = getPanel();
    // content div's parent is the content wrapper (empty padding area owner)
    const contentWrap = screen.getByText('content').parentElement!;
    drag(contentWrap, 40, 20);
    expect(panel.style.left).toBe('40px');
    expect(panel.style.top).toBe('20px');
  });

  it('moves the panel when dragging from the panel background itself', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 0, y: 0 }}>
        <div>content</div>
      </DraggablePanel>,
    );
    const panel = getPanel();
    drag(panel, 30, 15);
    expect(panel.style.left).toBe('30px');
    expect(panel.style.top).toBe('15px');
  });

  it('still moves the panel when dragging the handle', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 0, y: 0 }}>
        <div>content</div>
      </DraggablePanel>,
    );
    const panel = getPanel();
    drag(panel.firstElementChild as HTMLElement, 25, 5);
    expect(panel.style.left).toBe('25px');
    expect(panel.style.top).toBe('5px');
  });

  it('does not move the panel when pressing on a button inside it', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 0, y: 0 }}>
        <button type="button">press me</button>
        <div>content</div>
      </DraggablePanel>,
    );
    const panel = getPanel();
    const button = screen.getByRole('button', { name: 'press me' });
    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(button, { clientX: 90, clientY: 70 });
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(panel.style.left).toBe('0px');
    expect(panel.style.top).toBe('0px');
  });

  it('does not move the panel when pressing on a text node inside it', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 0, y: 0 }}>
        <div>content</div>
      </DraggablePanel>,
    );
    const panel = getPanel();
    const text = screen.getByText('content');
    fireEvent.pointerDown(text, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(text, { clientX: 90, clientY: 70 });
    fireEvent.pointerUp(text, { pointerId: 1 });
    expect(panel.style.left).toBe('0px');
    expect(panel.style.top).toBe('0px');
  });

  it('does not move the panel when pressing on an input inside it', () => {
    render(
      <DraggablePanel theme={lightTheme} initialPosition={{ x: 0, y: 0 }}>
        <input aria-label="field" />
        <div>content</div>
      </DraggablePanel>,
    );
    const panel = getPanel();
    const input = screen.getByLabelText('field');
    fireEvent.pointerDown(input, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(input, { clientX: 90, clientY: 70 });
    fireEvent.pointerUp(input, { pointerId: 1 });
    expect(panel.style.left).toBe('0px');
    expect(panel.style.top).toBe('0px');
  });
});
