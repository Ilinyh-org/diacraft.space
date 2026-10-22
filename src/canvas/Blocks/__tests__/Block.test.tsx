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

describe('Text comment block (issue #84)', () => {
  it('renders no connection handles when selected', () => {
    const { queryAllByTestId } = render(
      <Block x={0} y={0} type="text" selected theme={theme} />,
    );
    // Only the delete and edit buttons remain; connection handles must
    // not render for a text block.
    const circles = queryAllByTestId('circle');
    expect(circles).toHaveLength(2);
  });

  it('renders no shape behind the label', () => {
    const { queryByTestId } = render(
      <Block x={0} y={0} type="text" theme={theme} />,
    );
    expect(queryByTestId('rect')).toBeNull();
    expect(queryByTestId('line')).toBeNull();
  });
});

describe('Block handle drag reset', () => {
  it('resets the handle node position when a drag ends without connecting', () => {
    const onHandleDragEnd = vi.fn();
    const { getAllByTestId } = render(
      <Block
        x={100}
        y={50}
        width={120}
        height={60}
        selected
        theme={theme}
        onHandleDragEnd={onHandleDragEnd}
      />,
    );
    const circles = getAllByTestId('circle');
    // First circle is the top-side handle.
    const topHandle = circles[0];
    expect(topHandle).toBeTruthy();
    // Simulate Konva node leaving the anchor position during the drag.
    const position = vi.fn();
    const getAbsolutePosition = vi.fn(() => ({ x: 300, y: 200 }));
    const getStage = vi.fn(() => ({ x: () => 0, y: () => 0 }));
    fireEvent.dragEnd(topHandle, {
      target: { position, getAbsolutePosition, getStage },
    });
    expect(onHandleDragEnd).toHaveBeenCalledWith(300, 200);
    // Anchor for the top side: (x + w/2, y) = (160, 50).
    expect(position).toHaveBeenCalledWith({ x: 160, y: 50 });
  });

  it('reports drag positions in world coordinates when the stage is panned', () => {
    const onHandleDragEnd = vi.fn();
    const { getAllByTestId } = render(
      <Block
        x={100}
        y={50}
        width={120}
        height={60}
        selected
        theme={theme}
        onHandleDragEnd={onHandleDragEnd}
      />,
    );
    const topHandle = getAllByTestId('circle')[0];
    const position = vi.fn();
    // The handle sits at screen (565, 380) while the stage is panned by
    // (265, 330): the world point must be (300, 50).
    fireEvent.dragEnd(topHandle, {
      target: {
        position,
        getAbsolutePosition: () => ({ x: 565, y: 380 }),
        getStage: () => ({ x: () => 265, y: () => 330 }),
      },
    });
    expect(onHandleDragEnd).toHaveBeenCalledWith(300, 50);
  });
});

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
