import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { ComponentType } from 'react';
import { Block } from '../Block';
import type { Theme } from '../../../theme';

vi.mock('react-konva', () => {
  const makeNode =
    (name: string): ComponentType<Record<string, unknown>> =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      const { children, ...rest } = props;
      const handlers = Object.fromEntries(
        Object.entries(rest)
          .filter(([k]) => k.startsWith('on'))
          .map(([k, v]) => [k === 'onDblClick' ? 'onDoubleClick' : k, v]),
      );
      return (
        <div data-testid={name} {...handlers}>
          {props.text ?? children}
        </div>
      );
    };
  return {
    Rect: makeNode('rect'),
    Text: makeNode('text'),
    Group: makeNode('group'),
    Line: makeNode('line'),
    Ellipse: makeNode('ellipse'),
    Circle: makeNode('circle'),
  };
});

const theme = {
  blockStroke: '#000',
  blockFill: '#fff',
  blockText: '#000',
  selection: '#00f',
  deleteButton: '#f00',
  editButton: '#0f0',
} as unknown as Theme;

describe('Block label rename', () => {
  it('calls onEdit on double-click of the block label text', () => {
    const onEdit = vi.fn();
    const { getAllByTestId } = render(
      <Block x={0} y={0} label="Action" theme={theme} onEdit={onEdit} />,
    );
    const texts = getAllByTestId('text');
    const label = texts.find((el) => el.textContent === 'Action');
    expect(label).toBeTruthy();
    expect(onEdit).not.toHaveBeenCalled();
    fireEvent.dblClick(label!);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
