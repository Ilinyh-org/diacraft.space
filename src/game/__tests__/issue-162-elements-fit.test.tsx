import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GamePanel } from '../GamePanel';
import { lightTheme } from '../../theme';
import type { ArrowData, BlockData } from '../../canvas/types';

let nextId = 0;
const block = (label: string, type: BlockData['type'] = 'io'): BlockData => {
  nextId += 1;
  return { id: `b${nextId}`, x: 0, y: 0, width: 120, height: 60, label, type };
};
const arrow = (fromBlockId: string, toBlockId: string): ArrowData => {
  nextId += 1;
  return {
    id: `a${nextId}`,
    fromBlockId,
    fromSide: 'bottom',
    toBlockId,
    toSide: 'top',
    waypoints: [],
    label: undefined,
  };
};

const chart = (): { blocks: BlockData[]; arrows: ArrowData[] } => {
  const start = block('Start', 'start');
  const move1 = block('Move', 'action');
  const end = block('End', 'start');
  return {
    blocks: [start, move1, end],
    arrows: [arrow(start.id, move1.id), arrow(move1.id, end.id)],
  };
};

/**
 * Issue #162 (rework, 2026-10-27 owner comment): the two-menus-fit rule
 * narrowed the game panel to half the viewport on narrow screens, but the
 * panel content did not adapt — the bottom Run/Stop/prev/next button row
 * overflowed the narrowed form. Every element must fit inside the panel:
 * the bottom button row and the levels grid rows wrap instead of
 * overflowing.
 */
describe('issue #162 rework: all elements fit inside the narrowed panel', () => {
  afterEach(() => {
    cleanup();
  });

  it('the bottom Run/Stop/prev/next row wraps instead of overflowing', () => {
    const { blocks, arrows } = chart();
    render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '1' })); // close levels menu
    const runRow = screen.getByTestId('game-run-row');
    expect(runRow.style.flexWrap).toBe('wrap');
  });

  it('levels grid rows wrap so all five level buttons stay inside the panel', () => {
    const { blocks, arrows } = chart();
    render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />,
    );
    const btn = screen.getByTestId('game-level-1') as HTMLElement;
    const row = btn.parentElement as HTMLElement;
    expect(row.style.flexWrap).toBe('wrap');
    // The level button keeps a readable minimum width and never shrinks
    // below it.
    expect(btn.style.minWidth).toBe('24px');
    fireEvent.click(btn); // still selectable
  });
});
