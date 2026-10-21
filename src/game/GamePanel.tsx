import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DraggablePanel } from '../ui/DraggablePanel';
import type { Theme } from '../theme';
import type { ArrowData, BlockData } from '../canvas/types';
import { LEVELS } from './levels';
import { runProgram, wallAhead } from './types';
import type { Frame } from './types';
import { compileFlowchart, isEndBlock, statementForBlock } from './flowchart';
import { stepStatement } from './types';

const STEP_MS = 350;

const BUILD_HINT =
  'Build the program on the canvas: Start block, action blocks renamed ' +
  'to Move / Turn left / Turn right, then an End block, connected with arrows.';

type Props = {
  theme: Theme;
  blocks: BlockData[];
  arrows: ArrowData[];
  /** Incremented by the algorithm panel's Run button to arm the game. */
  runSignal?: number;
  /** Set by the diagram animation each time a block activates (issue #40). */
  blockSignal?: { seq: number; blockId: string } | null;
  /** Starts the canvas diagram animation (issue #33); called on button Run only. */
  onRunDiagram?: () => void;
};

export function GamePanel({
  theme,
  blocks,
  arrows,
  runSignal = 0,
  blockSignal = null,
  onRunDiagram,
}: Props) {
  const [levelIndex, setLevelIndex] = useState(0);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(true);
  const [highlighted, setHighlighted] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const lastSignalSeq = useRef(0);
  const syncState = useRef<{ frames: Frame[]; crashed: boolean } | null>(null);
  const highlightTimer = useRef<number | null>(null);

  const level = LEVELS[levelIndex];

  const buttonStyle: CSSProperties = {
    padding: '4px 8px',
    border: `1px solid ${theme.buttonBorder}`,
    borderRadius: 4,
    background: theme.buttonBg,
    color: theme.buttonText,
    cursor: 'pointer',
    fontSize: 11,
  };

  const reset = useCallback(() => {
    setFrames(null);
    setFrameIndex(0);
    setStatus(null);
    setHighlighted(false);
    setHasRun(false);
    syncState.current = null;
    lastSignalSeq.current = 0;
    if (highlightTimer.current !== null) {
      window.clearTimeout(highlightTimer.current);
      highlightTimer.current = null;
    }
  }, []);

  const pickLevel = useCallback(
    (index: number) => {
      setLevelIndex(index);
      reset();
      setMenuOpen(false);
    },
    [reset],
  );

  const compiled = useMemo(
    () => compileFlowchart(blocks, arrows),
    [blocks, arrows],
  );

  const run = useCallback(
    (fromButton: boolean) => {
      setHasRun(true);
      if (fromButton) onRunDiagram?.();
      if (!compiled.ok) {
        setFrames(null);
        setFrameIndex(0);
        setStatus(`✖ ${compiled.errors.join(' ')}`);
        return;
      }
      const result = runProgram(level, compiled.program);
      setFrames(result.frames);
      setFrameIndex(0);
      setStatus(
        result.status === 'win'
          ? '✔ Level complete!'
          : result.status === 'crash'
            ? '✖ The robot crashed into a wall.'
            : result.status === 'timeout'
              ? '✖ Program ran too long.'
              : '✖ The robot stopped short of the flag.',
      );
    },
    [compiled, level, onRunDiagram],
  );

  // The game panel's own ▶ Run button runs the whole program immediately.
  // The algorithm panel's Run button arms the game; the robot then moves in
  // sync with the diagram animation, one statement per activated block (#40).
  const armSync = useCallback(() => {
    reset();
    if (!compiled.ok) {
      setStatus(`✖ ${compiled.errors.join(' ')}`);
      return;
    }
    syncState.current = { frames: [{ ...level.start }], crashed: false };
    setFrames(syncState.current.frames);
    setFrameIndex(0);
  }, [compiled, level, reset]);

  const armSyncRef = useRef(armSync);
  useEffect(() => {
    armSyncRef.current = armSync;
  }, [armSync]);

  useEffect(() => {
    if (runSignal > 0) armSyncRef.current();
  }, [runSignal]);

  // Each activated action block advances the robot by one statement (#40).
  useEffect(() => {
    const sync = syncState.current;
    if (!blockSignal || blockSignal.seq <= lastSignalSeq.current || !sync) return;
    lastSignalSeq.current = blockSignal.seq;
    if (sync.crashed) return;

    const block = blocks.find((b) => b.id === blockSignal.blockId);
    if (!block) return;

    if (isEndBlock(block)) {
      const frame = sync.frames[sync.frames.length - 1];
      const won =
        !sync.crashed &&
        frame.x === level.goal.x &&
        frame.y === level.goal.y;
      setStatus(
        won ? '✔ Level complete!' : '✖ The robot stopped short of the flag.',
      );
      if (won) {
        setHighlighted(true);
        highlightTimer.current = window.setTimeout(() => {
          highlightTimer.current = null;
          setHighlighted(false);
        }, 3000);
      }
      return;
    }

    const stmt = statementForBlock(block);
    if (!stmt) return;
    const frame = sync.frames[sync.frames.length - 1];
    const next = stepStatement(level, frame, stmt);
    if (next.crashed) {
      sync.crashed = true;
      setStatus('✖ The robot crashed into a wall.');
      return;
    }
    sync.frames = [...sync.frames, next.frame];
    setFrames(sync.frames);
    setFrameIndex(sync.frames.length - 1);
  }, [blockSignal, blocks, level]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current !== null) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!frames || frameIndex >= frames.length - 1) return;
    const timer = setTimeout(() => setFrameIndex((i) => i + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [frames, frameIndex]);

  const current: Frame = frames ? frames[frameIndex] : { ...level.start };
  const solved = status?.startsWith('✔') ?? false;

  const cellPx = 36;

  const board = useMemo(() => {
    const cells: ReactNode[] = [];
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const isWall = level.walls.some(([wx, wy]) => wx === x && wy === y);
        const isGoal = level.goal.x === x && level.goal.y === y;
        cells.push(
          <div
            key={`${x},${y}`}
            style={{
              width: cellPx,
              height: cellPx,
              border: `1px solid ${theme.gridLine}`,
              background: isWall
                ? theme.blockStroke
                : isGoal
                  ? theme.runHighlight
                  : theme.blockFill,
              color: isGoal ? '#ffffff' : theme.blockText,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              boxSizing: 'border-box',
            }}
          >
            {isGoal ? '⚑' : ''}
          </div>,
        );
      }
    }
    return cells;
  }, [level, theme]);

  const arrowByDir = ['▲', '▶', '▼', '◀'][current.dir];

  return (
    <DraggablePanel
      theme={theme}
      initialPosition={{ x: Math.max(10, window.innerWidth - 340), y: 10 }}
    >
      <div
        data-testid="game-panel"
        style={{
          width: 320,
          padding: 10,
          fontFamily: 'inherit',
          color: theme.buttonText,
          userSelect: 'text',
          border: highlighted
            ? `2px solid ${theme.runHighlight}`
            : '2px solid transparent',
          borderRadius: 4,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 13 }}>Algorithm Game</strong>
          <button type="button" onClick={() => setMenuOpen((o) => !o)} style={buttonStyle}>
            Levels
          </button>
        </div>

        {menuOpen && (
          <div style={{ marginTop: 8 }}>
            {LEVELS.map((l, i) => (
              <button
                key={l.id}
                type="button"
                onClick={() => pickLevel(i)}
                style={{ ...buttonStyle, display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
              >
                {i + 1}. {l.title} — {l.concept}
              </button>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: theme.divider, margin: '6px 0' }} />

        <div style={{ fontSize: 11, marginBottom: 4 }}>
          <strong>{level.title}</strong> · {level.description}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${level.width}, ${cellPx}px)`,
            width: level.width * cellPx,
            position: 'relative',
          }}
        >
          {board}
          <div
            data-testid="game-robot"
            style={{
              position: 'absolute',
              left: current.x * cellPx,
              top: current.y * cellPx,
              width: cellPx,
              height: cellPx,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              color: theme.selection,
              transition: 'left 200ms, top 200ms',
              pointerEvents: 'none',
            }}
          >
            {arrowByDir}
          </div>
        </div>
        {wallAhead(level, current) && (
          <div style={{ fontSize: 10, color: theme.deleteButton, marginTop: 2 }}>
            Wall directly ahead!
          </div>
        )}

        <div style={{ height: 1, background: theme.divider, margin: '6px 0' }} />

        {hasRun && (
          <div style={{ fontSize: 10, color: theme.buttonTextDisabled, marginBottom: 4 }}>
            {BUILD_HINT}
          </div>
        )}

        {!compiled.ok && (
          <div data-testid="flowchart-errors" style={{ fontSize: 11, color: theme.deleteButton }}>
            {compiled.errors.map((e, i) => (
              <div key={i}>✖ {e}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => run(true)}
            style={buttonStyle}
          >
            ▶ Run
          </button>
        </div>

        <div style={{ fontSize: 11, marginTop: 6, minHeight: 16 }} role="status">
          {status} {solved && levelIndex < LEVELS.length - 1 && (
            <button type="button" onClick={() => pickLevel(levelIndex + 1)} style={{ ...buttonStyle, marginLeft: 6 }}>
              Next level →
            </button>
          )}
        </div>
      </div>
    </DraggablePanel>
  );
}
