import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GamePanel } from '../GamePanel';
import { lightTheme } from '../../theme';
import { LEVELS } from '../levels';

/**
 * Issue #171 (rework): a level that has a sign or a box must change its
 * description so the user knows they should read the sign / open the box.
 */
beforeEach(() => {
  cleanup();
  window.localStorage.clear();
});

vi.mock('../../canvas/AlgorithmPanel', async () => ({ stepDelayMs: () => 0 }));

function openLevel(n: number) {
  render(
    <GamePanel language="en" theme={lightTheme} blocks={[]} arrows={[]} />,
  );
  // The levels menu is open initially; pick the level directly.
  fireEvent.click(screen.getByRole('button', { name: String(n) }));
  return screen.getByTestId('game-task').textContent ?? '';
}

describe('issue #171 rework: sign/box level descriptions', () => {
  it('arrays-26 exists with a sign', () => {
    expect(LEVELS.find((l) => l.id === 'arrays-26')?.signs?.length).toBeGreaterThan(0);
  });

  it('arrays-27 exists with a box', () => {
    expect(LEVELS.find((l) => l.id === 'arrays-27')?.boxes?.length).toBeGreaterThan(0);
  });

  it('arrays-26 task tells the user to read the sign (en)', () => {
    const task = openLevel(26);
    expect(task).toMatch(/read/i);
    expect(task).toMatch(/sign/i);
  });

  it('arrays-27 task tells the user to open the box (en)', () => {
    const task = openLevel(27);
    expect(task).toMatch(/open/i);
    expect(task).toMatch(/box/i);
  });
});
