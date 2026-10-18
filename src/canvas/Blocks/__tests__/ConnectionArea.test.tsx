import { describe, expect, it, vi, beforeEach } from 'vitest';
import { forwardRef, useImperativeHandle } from 'react';
import { render } from '@testing-library/react';
import { ConnectionArea } from '../ConnectionArea';
import type { Theme } from '../../../theme';

const tweenCalls: Array<Record<string, unknown>> = [];

vi.mock('react-konva', () => ({
  Circle: forwardRef((props: Record<string, unknown>, ref) => {
    useImperativeHandle(ref, () => ({
      opacity: vi.fn(),
      to: (cfg: Record<string, unknown>) => {
        tweenCalls.push(cfg);
      },
      getLayer: () => ({}),
      dashOffset: vi.fn(),
    }));
    return (
      <div
        data-testid="connection-area-circle"
        data-x={String(props.x)}
        data-y={String(props.y)}
        data-radius={String(props.radius)}
        data-dash={JSON.stringify(props.dash)}
      />
    );
  }),
}));

vi.mock('konva', () => ({
  default: {
    Animation: class {
      frameFn: unknown;
      layer: unknown;
      constructor(frameFn: unknown, layer: unknown) {
        this.frameFn = frameFn;
        this.layer = layer;
      }
      start() {}
      stop() {}
    },
    Easings: { EaseOut: (t: number) => t, EaseIn: (t: number) => t },
  },
}));

vi.mock('konva/lib/Node', () => ({}));

const theme = {
  selection: '#00f',
} as unknown as Theme;

describe('ConnectionArea', () => {
  beforeEach(() => {
    tweenCalls.length = 0;
  });

  it('renders a dashed circle at the given anchor position', () => {
    const { getByTestId } = render(
      <ConnectionArea x={120} y={80} theme={theme} visible={false} />,
    );
    const el = getByTestId('connection-area-circle');
    expect(el.dataset.x).toBe('120');
    expect(el.dataset.y).toBe('80');
    expect(el.dataset.radius).toBe('19.8');
    expect(JSON.parse(el.dataset.dash ?? '')).toEqual([6, 6]);
  });

  it('animates opacity from 0 to 1 when it becomes visible', () => {
    const { rerender } = render(
      <ConnectionArea x={0} y={0} theme={theme} visible={false} />,
    );
    rerender(<ConnectionArea x={0} y={0} theme={theme} visible={true} />);
    expect(tweenCalls).toContainEqual(expect.objectContaining({ opacity: 1 }));
  });

  it('animates opacity back to 0 when it becomes hidden', () => {
    const { rerender } = render(
      <ConnectionArea x={0} y={0} theme={theme} visible={true} />,
    );
    rerender(<ConnectionArea x={0} y={0} theme={theme} visible={false} />);
    expect(tweenCalls).toContainEqual(expect.objectContaining({ opacity: 0 }));
  });
});
