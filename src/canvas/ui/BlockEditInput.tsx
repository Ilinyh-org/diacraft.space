import type { RefObject } from 'react';
import type { Theme } from '../../theme';
import type { BlockData } from '../types';

type BlockEditInputProps = {
  theme: Theme;
  block: BlockData;
  stageX: number;
  stageY: number;
  /** Issue #82: the input must follow the zoomed-out view too. */
  stageScale: number;
  value: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (v: string) => void;
  onCommit: () => void;
};

export function BlockEditInput({
  theme,
  block,
  stageX,
  stageY,
  stageScale,
  value,
  inputRef,
  onChange,
  onCommit,
}: BlockEditInputProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: stageX + block.x * stageScale - 4,
        top:
          stageY +
          block.y * stageScale +
          (block.height * stageScale) / 2 -
          18,
        width: (block.width + 8) * stageScale,
        zIndex: 500,
      }}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        rows={Math.max(1, value.split('\n').length)}
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: 14,
          textAlign: 'center',
          border: `2px solid ${theme.selection}`,
          borderRadius: 6,
          outline: 'none',
          background: theme.inputBg,
          color: theme.inputText,
          boxShadow: `0 2px 8px ${theme.panelShadow}`,
          resize: 'none',
          overflow: 'hidden',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}
