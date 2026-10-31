import { describe, it, afterEach, expect } from 'vitest';
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
  } as unknown as ArrowData;
};
const chart = () => {
  const a = block('A');
  const b = block('B');
  return { blocks: [a, b], arrows: [arrow(a.id, b.id)] };
};

/**
 * Issue #180: the previous/next level switchers move up into the header
 * line, on one row with the Levels button, positioned to the right of it.
 */
describe('issue #180: prev/next buttons on the header row next to Levels', () => {
  afterEach(() => {
    cleanup();
  });

  it('prev and next share one row with the Levels button, to its right', () => {
    const { blocks, arrows } = chart();
    render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '1' })); // close levels menu

    const prev = screen.getByTestId('game-prev-level');
    const next = screen.getByTestId('game-next-level');
    const row = prev.parentElement as HTMLElement;
    expect(row).toBe(next.parentElement as HTMLElement);

    // The row is the header row: it contains the Levels toggle too.
    const children = Array.from(row.children) as HTMLElement[];
    expect(children).toContain(prev);
    expect(children).toContain(next);
    const levelsIdx = children.findIndex((el) => el.textContent === 'Levels');
    expect(levelsIdx).toBeGreaterThanOrEqual(0);
    // Buttons sit to the right of the Levels button.
    expect(children.indexOf(prev)).toBeGreaterThan(levelsIdx);
    expect(children.indexOf(next)).toBeGreaterThan(levelsIdx);
    // One line: no wrapping on the header row.
    expect(row.style.flexWrap).not.toBe('wrap');
  });

  it('prev/next stay hidden on the levels menu', () => {
    const { blocks, arrows } = chart();
    render(
      <GamePanel language="en" theme={lightTheme} blocks={blocks} arrows={arrows} />,
    );
    expect(screen.queryByTestId('game-prev-level')).toBeNull();
    expect(screen.queryByTestId('game-next-level')).toBeNull();
  });
});
