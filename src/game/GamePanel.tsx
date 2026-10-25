import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DraggablePanel } from '../ui/DraggablePanel';
import { stepDelayMs } from '../canvas/ui/AlgorithmPanel';
import type { Theme } from '../theme';
import type { ArrowData, BlockData } from '../canvas/types';
import { IO_LEVEL_IDS, LEVELS } from './levels';
import type { Frame } from './types';
import { compileFlowchart, isEndBlock, statementForBlock } from './flowchart';
import { stepStatement } from './types';
import { t, tOptional, type LanguageCode } from '../canvas/ui/i18n';

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
  /** Diagram animation speed (1-10, new #109 scale); drives the robot's movement speed (#40). */
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
  speed = 5,
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

  // Issue #117: the Program I/O line only exists on the level page of a
  // level whose task uses input/output — never on the levels menu.
  const levelUsesIo = IO_LEVEL_IDS.has(level.id);

  // Issue #107: a short task text above the level graphics. Levels with a
  // dedicated description use it; the rest get the generic goal text.
  const taskText =
    tOptional(language, `game.level.${level.id}.description`) ??
    t(language, 'game.taskFallback');

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

  // Issue #91: the game panel's ▶ Run button works exactly like the
  // algorithm panel's Run button: it starts the diagram animation and arms
  // the game; the robot then moves in sync with the animation, one statement
  // per activated block, and the level pass conditions are checked as the
  // animation runs. The `runSignal` effect arms the game the same way.
  const run = useCallback(() => {
    armSync();
    setHasRun(true);
    onRunDiagram?.();
  }, [armSync, onRunDiagram]);

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
      center
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

        {/* Issue #107 (rework): the levels menu is an exclusive view —
            while it is open, no level content is shown on the same page. */}
        {menuOpen && (
          <div data-testid="game-levels-menu" style={{ marginTop: 8 }}>
            {/* Issue #70: 5x5 numbered levels table — five concept rows.
                Issue #127: every level is offered; the current level's
                button is disabled and highlighted instead of omitted. */}
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {LEVELS.slice(row * 5, row * 5 + 5).map((l, col) => {
                  const index = row * 5 + col;
                  const isCurrent = index === levelIndex;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      title={`${t(language, 'game.levelName', { n: index + 1 })}`}
                      onClick={() => pickLevel(index)}
                      disabled={isCurrent}
                      aria-current={isCurrent ? 'true' : undefined}
                      data-testid={`game-level-${index + 1}`}
                      style={{
                        ...buttonStyle,
                        width: 40,
                        textAlign: 'center',
                        ...(isCurrent
                          ? { background: theme.runHighlight, color: '#ffffff', cursor: 'default', opacity: 1 }
                          : {}),
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

        {/* Issue #130: the redundant hline after the levels menu is
            removed — the header already separates the menu from the
            level view. */}
        {/* Issue #119/#132: the level header line keeps only the
            "Level N" label — the result message moved to its own line
            between the level view and the Run button. Rendered also while
            the levels menu is open, like the old status line. */}
        {/* Issue #124: the level header/status line is part of the level
            view — the levels menu is an exclusive view without it. */}
        {!menuOpen && (
        <div style={{ fontSize: 11, marginTop: 6 }}>
          <strong>{t(language, 'game.levelName', { n: levelIndex + 1 })}</strong>
        </div>
        )}

        {/* Issue #107: short task text above the level graphics. Hidden
            together with the board while the levels menu is open. */}
        {!menuOpen && (
        <>
        <div data-testid="game-task" style={{ fontSize: 11, marginBottom: 4 }}>
          <strong>{t(language, 'game.task')}:</strong> {taskText}
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

        {/* Issue #117: the Program I/O line sits right after the graphical
            part, and only on I/O task levels. */}
        {levelUsesIo && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label
                htmlFor="game-io-input"
                style={{ fontSize: 10, whiteSpace: 'nowrap' }}
              >
                {t(language, 'game.ioTitle')}
              </label>
              <input
                id="game-io-input"
                type="text"
                value={ioText}
                onChange={(e) => setIoText(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  boxSizing: 'border-box',
                  padding: '3px 5px',
                  fontSize: 11,
                  border: `1px solid ${theme.buttonBorder}`,
                  borderRadius: 4,
                  background: theme.blockFill,
                  color: theme.buttonText,
                }}
              />
            </div>
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
        )}
        </>
        )}

        {/* Issue #130: the redundant hline between the level view and the
            run area is removed — the Run button block already has its own
            margin. */}

        {/* Issue #107: the error hint appears and updates only after the
            Run click, when the animation starts. */}
        {hasRun && !compiled.ok && (
          <div data-testid="flowchart-errors" style={{ fontSize: 11, color: theme.deleteButton }}>
            {compiled.errors.map((e, i) => (
              <div key={i}>✖ {e}</div>
            ))}
          </div>
        )}

        {/* Issue #124: the Run button belongs to the level view — hidden
            while the levels menu is open. */}
        {/* Issue #132: the game result message (level complete / stopped
            short / crash) sits in its own line between the level view and
            the Run button, green when the level is complete. Always present
            in the level view to keep the run area layout stable. */}
        {!menuOpen && (
          <div
            role="status"
            style={{
              fontSize: 11,
              marginTop: 6,
              minHeight: 16,
            }}
          >
            {status && (
              <span style={{ color: solved ? theme.runHighlight : undefined }}>
                {status}
              </span>
            )}
          </div>
        )}

        {/* Issue #124: the Run button belongs to the level view — hidden
            while the levels menu is open. */}
        {!menuOpen && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={run}
            style={buttonStyle}
          >
            {t(language, 'game.run')}
          </button>
        </div>
        )}

        {/* Issue #107: the Program I/O line moved above the run area — the
            space between the run buttons and the level switchers. */}
        {/* Issue #127: the previous/next level buttons are removed — the
            levels menu covers switching between all levels. */}
      </div>
    </DraggablePanel>
  );
}
