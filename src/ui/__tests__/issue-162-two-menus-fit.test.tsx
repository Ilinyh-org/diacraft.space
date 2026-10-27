import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  DraggablePanel,
  PANEL_CLASS,
  panelMaxWidth,
  PC_MIN_WIDTH,
} from '../DraggablePanel';
import type { Theme } from '../../theme';

const theme = {} as Theme;

function setViewport(width: number, height = 800) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

describe('issue #162: the two widest menus must fit on the screen', () => {
  beforeEach(() => {
    setViewport(PC_MIN_WIDTH - 1); // narrow (mobile) screen
  });

  afterEach(() => {
    cleanup();
    setViewport(1024);
  });

  it('panelMaxWidth caps participating panels at half the viewport on narrow screens', () => {
    expect(panelMaxWidth(true, { width: 360, height: 800 })).toBe('calc(50vw - 12px)');
    expect(panelMaxWidth(true, { width: PC_MIN_WIDTH - 1, height: 800 })).toBe(
      'calc(50vw - 12px)',
    );
  });

  it('panelMaxWidth leaves non-participating panels and PC screens unchanged', () => {
    expect(panelMaxWidth(false, { width: 360, height: 800 })).toBe('calc(100vw - 16px)');
    expect(panelMaxWidth(true, { width: PC_MIN_WIDTH, height: 800 })).toBe(
      'calc(100vw - 16px)',
    );
  });

  it('a participating panel is capped at half the viewport on a narrow screen', () => {
    setViewport(360);
    const { container } = render(
      <DraggablePanel theme={theme} initialPosition={{ x: 10, y: 10 }} fitTwoPanels>
        <div>content</div>
      </DraggablePanel>,
    );
    const panel = container.querySelector(`.${PANEL_CLASS}`) as HTMLElement;
    expect(panel.style.maxWidth).toBe('calc(50vw - 12px)');
  });

  it('a non-participating panel keeps the full-viewport cap', () => {
    setViewport(360);
    const { container } = render(
      <DraggablePanel theme={theme} initialPosition={{ x: 10, y: 10 }}>
        <div>content</div>
      </DraggablePanel>,
    );
    const panel = container.querySelector(`.${PANEL_CLASS}`) as HTMLElement;
    expect(panel.style.maxWidth).toBe('calc(100vw - 16px)');
  });
});
