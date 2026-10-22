import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DraggablePanel } from '../ui/DraggablePanel';
import { stepDelayMs } from '../canvas/ui/AlgorithmPanel';
import type { Theme } from '../theme';
import type { ArrowData, BlockData } from '../canvas/types';
import { LEVELS } from './levels';
import { runProgram, wallAhead } from './types';
import type { Dir, Frame } from './types';
import { compileFlowchart, isEndBlock, statementForBlock } from './flowchart';
import { stepStatement } from './types';
import { t, type LanguageCode } from '../canvas/ui/i18n';

/** Parses the game menu's I/O field into directions for `in` blocks (#70). */
const DIR_BY_WORD: Record<string, Dir> = {
  up: 0,
  right: 1,
  down: 2,
  left: 3,
  вверх: 0,
  вправо: 1,
  вниз: 2,
  влево: 3,
};

const parseIoInput = (text: string): Dir[] =>
  text
    .split(/[\s,;]+/)
    .map((w) => DIR_BY_WORD[w.trim().toLowerCase()])
    .filter((d): d is Dir => d !== undefined);

type Props = {
  theme: Theme;
  language: LanguageCode;
  blocks: BlockData[];
  arrows: ArrowData[];
  /** Incremented by the algorithm panel's Run button to arm the game. */
  runSignal?: number;
  /** Set by the diagram animation each time a block activates (issue #40). */
  blockSignal?: { seq: number; blockId: string } | null;
  /** Starts the canvas diagram animation (issue #33); called on button Run only. */
  onRunDiagram?: () => void;
  /** Diagram animation speed (1-10); drives the robot's movement speed (#40). */
  speed?: number;
};

export function GamePanel({
  theme,
  language,
  blocks,
  arrows,
  runSignal = 0,
  blockSignal = null,
  onRunDiagram,
  speed = 3,
}: Props) {
  const [levelIndex, setLevelIndex] = useState(0);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(true);
  const [highlighted, setHighlighted] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [ioText, setIoText] = useState('');
  const [ioOutput, setIoOutput] = useState<string[]>([]);
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
    setIoOutput([]);
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
    () => compileFlowchart(blocks, arrows, language),
    [blocks, arrows, language],
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
      const result = runProgram(
        level,
        compiled.program,
        compiled.subprograms,
        parseIoInput(ioText),
      );
      setFrames(result.frames);
      setFrameIndex(0);
      setIoOutput(result.output);
      setStatus(
        result.status === 'win'
          ? t(language, 'game.win')
          : result.status === 'crash'
            ? t(language, 'game.crash')
            : result.status === 'needInput'
              ? t(language, 'game.needInput')
              : result.status === 'timeout'
                ? t(language, 'game.timeout')
                : t(language, 'game.tooShort'),
      );
    },
    [compiled, level, onRunDiagram, language, ioText],
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
        won
          ? t(language, 'game.win')
          : t(language, 'game.tooShort'),
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
      setStatus(t(language, 'game.crash'));
      return;
    }
    sync.frames = [...sync.frames, next.frame];
    setFrames(sync.frames);
    setFrameIndex(sync.frames.length - 1);
  }, [blockSignal, blocks, level, speed, language]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current !== null) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!frames || frameIndex >= frames.length - 1) return;
    const timer = setTimeout(() => setFrameIndex((i) => i + 1), stepDelayMs(speed));
    return () => clearTimeout(timer);
  }, [frames, frameIndex, speed]);

  const current: Frame = frames ? frames[frameIndex] : { ...level.start };
  const solved = status?.startsWith('✔') ?? false;

  const cellPx = 28;

  const board = useMemo(() => {
    const cells: ReactNode[] = [];
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const isWall = level.walls.some(([wx, wy]) => wx === x && wy === y);
        const isGoal = level.goal.x === x && level.goal.y === y;
        const hasItem = (level.items ?? []).some(([ix, iy]) => ix === x && iy === y);
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
            {isGoal ? '⚑' : hasItem ? '◆' : ''}
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
      initialPosition={{ x: Math.max(10, window.innerWidth - 270), y: 10 }}
      storageKey="diacraft-panel-pos-game"
    >
      <div
        data-testid="game-panel"
        style={{
          width: 244,
          padding: 8,
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
          <strong style={{ fontSize: 13 }}>{t(language, 'game.title')}</strong>
          <button type="button" onClick={() => setMenuOpen((o) => !o)} style={buttonStyle}>
            {t(language, 'game.levels')}
          </button>
        </div>

        {menuOpen && (
          <div style={{ marginTop: 8 }}>
            {/* Issue #70: 5x5 numbered levels table — five concept rows. */}
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {LEVELS.slice(row * 5, row * 5 + 5).map((l, col) => {
                  const index = row * 5 + col;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      title={`${t(language, 'game.levelName', { n: index + 1 })}`}
                      onClick={() => pickLevel(index)}
                      style={{
                        ...buttonStyle,
                        width: 40,
                        textAlign: 'center',
                        fontWeight: index === levelIndex ? 700 : 400,
                        borderColor:
                          index === levelIndex ? theme.selection : theme.buttonBorder,
                      }}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: theme.divider, margin: '6px 0' }} />

        <div style={{ fontSize: 11, marginBottom: 4 }}>
          <strong>{t(language, 'game.levelName', { n: levelIndex + 1 })}</strong>
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
              transition: `left ${stepDelayMs(speed)}ms, top ${stepDelayMs(speed)}ms`,
              pointerEvents: 'none',
            }}
          >
            {arrowByDir}
          </div>
        </div>
        {wallAhead(level, current) && (
          <div style={{ fontSize: 10, color: theme.deleteButton, marginTop: 2 }}>
            {t(language, 'game.wallAhead')}
          </div>
        )}

        <div style={{ height: 1, background: theme.divider, margin: '6px 0' }} />

        {hasRun && (
          <div style={{ fontSize: 10, color: theme.buttonTextDisabled, marginBottom: 4 }}>
            {t(language, 'game.buildHint')}
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
            {t(language, 'game.run')}
          </button>
        </div>

        {/* Issue #70: program I/O field — input directions + output log. */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, marginBottom: 2 }}>
            {t(language, 'game.ioTitle')}
          </div>
          <div style={{ fontSize: 10, color: theme.buttonTextDisabled, marginBottom: 2 }}>
            {t(language, 'game.ioInputHint')}
          </div>
          <input
            type="text"
            value={ioText}
            onChange={(e) => setIoText(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '3px 5px',
              fontSize: 11,
              border: `1px solid ${theme.buttonBorder}`,
              borderRadius: 4,
              background: theme.blockFill,
              color: theme.buttonText,
            }}
          />
          {ioOutput.length > 0 && (
            <div
              data-testid="game-io-output"
              role="log"
              style={{
                marginTop: 4,
                fontSize: 10,
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
              }}
            >
              {ioOutput.map((line, i) => (
                <div key={i}>› {line}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, marginTop: 6, minHeight: 16 }} role="status">
          {status} {solved && levelIndex < LEVELS.length - 1 && (
            <button type="button" onClick={() => pickLevel(levelIndex + 1)} style={{ ...buttonStyle, marginLeft: 6 }}>
              {t(language, 'game.nextLevel')}
            </button>
          )}
        </div>
      </div>
    </DraggablePanel>
  );
}
