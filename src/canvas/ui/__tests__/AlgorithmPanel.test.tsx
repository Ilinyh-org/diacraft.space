import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlgorithmPanel, MIN_SPEED, MAX_SPEED } from '../AlgorithmPanel';
import { lightTheme } from '../../../theme';

function setup(overrides: Partial<Parameters<typeof AlgorithmPanel>[0]> = {}) {
  const props = {
    theme: lightTheme,
    running: false,
    speed: 3,
    onRun: vi.fn(),
    onStop: vi.fn(),
    onSpeedChange: vi.fn(),
    language: "en" as const,
    ...overrides,
  };
  render(<AlgorithmPanel {...props} />);
  return props;
}

describe('AlgorithmPanel', () => {
  it('renders a Run button and a speed ruler', () => {
    setup();
    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByText('Speed: 3')).toBeInTheDocument();
    const slider = screen.getByLabelText('Speed: 3') as HTMLInputElement;
    expect(slider.min).toBe(String(MIN_SPEED));
    expect(slider.max).toBe(String(MAX_SPEED));
    expect(slider.value).toBe('3');
  });

  it('calls onRun when Run is clicked', () => {
    const props = setup();
    fireEvent.click(screen.getByText('Run'));
    expect(props.onRun).toHaveBeenCalledTimes(1);
    expect(props.onStop).not.toHaveBeenCalled();
  });

  it('shows Stop while running and calls onStop', () => {
    const props = setup({ running: true });
    expect(screen.getByText('Stop')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Stop'));
    expect(props.onStop).toHaveBeenCalledTimes(1);
    expect(props.onRun).not.toHaveBeenCalled();
  });

  it('reports speed changes from the ruler', () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText('Speed: 3'), {
      target: { value: '7' },
    });
    expect(props.onSpeedChange).toHaveBeenCalledWith(7);
  });
});
