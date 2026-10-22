import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';

/* Issue #81 (rework): the GAME menu, not the main menu, must first appear
 * centered on PC-sized screens. Mock DraggablePanel to capture the props
 * GamePanel passes to it. */

type DraggablePanelProps = {
  initialPosition: { x: number; y: number };
  center?: boolean;
  storageKey?: string;
  children: ReactNode;
};

const captured: DraggablePanelProps[] = [];

vi.mock('../../ui/DraggablePanel', () => ({
  DraggablePanel: ((props: DraggablePanelProps) => {
    captured.push(props);
    return <div>{props.children}</div>;
  }) as unknown as ComponentType<DraggablePanelProps>,
}));

import { GamePanel } from '../GamePanel';
import { lightTheme } from '../../theme';

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  captured.length = 0;
});

describe('GamePanel first appearance (issue #81)', () => {
  it('requests a centered first position on PC-sized screens', () => {
    render(<GamePanel theme={lightTheme} language="en" blocks={[]} arrows={[]} />);
    expect(captured).toHaveLength(1);
    expect(captured[0].center).toBe(true);
  });

  it('keeps remembering its dragged position across sessions', () => {
    render(<GamePanel theme={lightTheme} language="en" blocks={[]} arrows={[]} />);
    expect(captured[0].storageKey).toBe('diacraft-panel-pos-game');
  });
});
