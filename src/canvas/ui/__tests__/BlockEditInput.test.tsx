import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockEditInput } from '../BlockEditInput';
import { lightTheme } from '../../../theme';
import type { BlockData } from '../../types';

const block: BlockData = {
  id: 'b1',
  type: 'action',
  x: 100,
  y: 200,
  width: 120,
  height: 60,
  label: 'Step',
};

describe('BlockEditInput', () => {
  it('renders an input positioned over the block', () => {
    render(
      <BlockEditInput
        theme={lightTheme}
        block={block}
        stageX={10}
        stageY={20}
        value="Step"
        inputRef={createRef()}
        onChange={() => {}}
        onCommit={() => {}}
      />,
    );
    const input = screen.getByDisplayValue('Step');
    expect(input).toBeInTheDocument();
    const wrapper = input.closest('div')!;
    expect(wrapper.style.left).toBe('106px'); // stageX + block.x - 4
    expect(wrapper.style.top).toBe('232px'); // stageY + block.y + h/2 - 18
  });

  it('reports value changes', () => {
    const onChange = vi.fn();
    render(
      <BlockEditInput
        theme={lightTheme}
        block={block}
        stageX={0}
        stageY={0}
        value=""
        inputRef={createRef()}
        onChange={onChange}
        onCommit={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'New name' },
    });
    expect(onChange).toHaveBeenCalledWith('New name');
  });

  it('commits on blur', () => {
    const onCommit = vi.fn();
    render(
      <BlockEditInput
        theme={lightTheme}
        block={block}
        stageX={0}
        stageY={0}
        value="Step"
        inputRef={createRef()}
        onChange={() => {}}
        onCommit={onCommit}
      />,
    );
    fireEvent.blur(screen.getByDisplayValue('Step'));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
