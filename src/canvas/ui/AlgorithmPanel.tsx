import type { CSSProperties } from 'react';
import { DraggablePanel } from '../../ui/DraggablePanel';
import type { Theme } from '../../theme';

export const MIN_SPEED = 1;
export const MAX_SPEED = 10;

type AlgorithmPanelProps = {
  theme: Theme;
  running: boolean;
  speed: number;
  onRun: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
};

export function AlgorithmPanel({
  theme,
  running,
  speed,
  onRun,
  onStop,
  onSpeedChange,
}: AlgorithmPanelProps) {
  const buttonStyle: CSSProperties = {
    padding: '6px 10px',
    border: `1px solid ${theme.buttonBorder}`,
    borderRadius: 4,
    background: theme.buttonBg,
    color: theme.buttonText,
    cursor: 'pointer',
    fontSize: 12,
    textAlign: 'center',
  };

  return (
    <DraggablePanel
      theme={theme}
      initialPosition={{
        x: Math.max(10, window.innerWidth - 190),
        y: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textAlign: 'center',
          color: theme.buttonTextDisabled,
          marginBottom: 2,
        }}
      >
        Algorithm
      </div>
      <button
        onClick={running ? onStop : onRun}
        style={{
          ...buttonStyle,
          color: running ? theme.deleteButton : theme.addButton,
          borderColor: running ? theme.deleteButton : theme.addButton,
        }}
      >
        {running ? 'Stop' : 'Run'}
      </button>

      <div style={{ height: 1, background: theme.divider, margin: '4px 0' }} />

      <label
        htmlFor="algorithm-speed"
        style={{
          fontSize: 11,
          color: theme.buttonText,
          textAlign: 'center',
        }}
      >
        Speed: {speed}
      </label>
      <input
        id="algorithm-speed"
        type="range"
        min={MIN_SPEED}
        max={MAX_SPEED}
        step={1}
        value={speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        style={{ accentColor: theme.selection }}
      />
    </DraggablePanel>
  );
}
