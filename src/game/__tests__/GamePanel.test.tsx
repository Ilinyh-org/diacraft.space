import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GamePanel } from '../GamePanel';
import { lightTheme } from '../../theme';

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('GamePanel', () => {
  it('renders the level board and command buttons of the first level', () => {
    render(<GamePanel theme={lightTheme} />);
    expect(screen.getByTestId('game-panel')).toBeDefined();
    expect(screen.getByText('First steps')).toBeDefined();
    expect(screen.getByRole('button', { name: '+ Move' })).toBeDefined();
    expect(screen.getByTestId('game-robot')).toBeDefined();
  });

  it('limits commands to the ones the level allows', () => {
    render(<GamePanel theme={lightTheme} />);
    expect(screen.queryByRole('button', { name: '+ Repeat…' })).toBeNull();
  });

  it('adds commands and wins the first level', () => {
    render(<GamePanel theme={lightTheme} />);
    const move = screen.getByRole('button', { name: '+ Move' });
    fireEvent.click(move);
    fireEvent.click(move);
    fireEvent.click(move);
    expect(screen.getByText('Commands: 3')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(screen.getByRole('status').textContent).toContain('Level complete');
  });

  it('reports a crash when the robot walks into a wall', () => {
    render(<GamePanel theme={lightTheme} />);
    const move = screen.getByRole('button', { name: '+ Move' });
    for (let i = 0; i < 5; i += 1) fireEvent.click(move);
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }));
    expect(screen.getByRole('status').textContent).toContain('crashed');
  });

  it('removes a command from the program', () => {
    render(<GamePanel theme={lightTheme} />);
    const move = screen.getByRole('button', { name: '+ Move' });
    fireEvent.click(move);
    fireEvent.click(screen.getByLabelText('Remove command 0'));
    expect(screen.getByText('Commands: 0')).toBeDefined();
  });

  it('switches levels from the menu and resets the program', () => {
    render(<GamePanel theme={lightTheme} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Move' }));
    fireEvent.click(screen.getByRole('button', { name: /The corner/ }));
    expect(screen.getByText('The corner')).toBeDefined();
    expect(screen.getByText('Commands: 0')).toBeDefined();
    expect(screen.getByRole('button', { name: '+ ⟲ Left' })).toBeDefined();
    expect(screen.queryByRole('button', { name: '+ If wall ahead…' })).toBeNull();
  });
});
