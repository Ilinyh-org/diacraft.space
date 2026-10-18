import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DraggablePanel } from '../ui/DraggablePanel';
import type { Theme } from '../theme';
import { LEVELS } from './levels';
import { runProgram, wallAhead } from './types';
import type { Frame, Statement, StatementKind } from './types';

const COMMAND_LABEL: Record<StatementKind, string> = {
  move: 'Move',
  turnLeft: '⟲ Left',
  turnRight: '⟳ Right',
  repeat: 'Repeat…',
  ifWall: 'If wall ahead…',
};

const STEP_MS = 350;

function countStatements(stmts: Statement[]): number {
  return stmts.reduce(
    (sum, s) =>
      sum +
      1 +
      (s.kind === 'repeat'
        ? countStatements(s.body)
        : s.kind === 'ifWall'
          ? countStatements(s.then) + countStatements(s.else)
          : 0),
    0,
  );
}

function removeFromChild(stmt: Statement, path: number[]): Statement {
  if (stmt.kind === 'repeat') {
    return { ...stmt, body: removeAt(stmt.body, path) };
  }
  if (stmt.kind === 'ifWall') {
    const [branch, ...rest] = path;
    return branch === 0
      ? { ...stmt, then: removeAt(stmt.then, rest) }
      : { ...stmt, else: removeAt(stmt.else, rest) };
  }
  return stmt;
}

function removeAt(stmts: Statement[], path: number[]): Statement[] {
  if (path.length === 0) return stmts;
  const [head, ...rest] = path;
  if (rest.length === 0) return stmts.filter((_, i) => i !== head);
  return stmts.map((s, i) => (i === head ? removeFromChild(s, rest) : s));
}

function insertInto(
  stmts: Statement[],
  path: number[],
  stmt: Statement,
): Statement[] {
  if (path.length === 0) return [...stmts, stmt];
  const [head, ...rest] = path;
  return stmts.map((s, i) => (i === head ? withInsertedChild(s, rest, stmt) : s));
}

function withInsertedChild(
  stmt: Statement,
  path: number[],
  child: Statement,
): Statement {
  if (stmt.kind === 'repeat') {
    return { ...stmt, body: insertInto(stmt.body, path, child) };
  }
  if (stmt.kind === 'ifWall') {
    const [branch, ...rest] = path;
    return branch === 0
      ? { ...stmt, then: insertInto(stmt.then, rest, child) }
      : { ...stmt, else: insertInto(stmt.else, rest, child) };
  }
  return stmt;
}

function statementLabel(stmt: Statement): string {
  if (stmt.kind === 'repeat') return `Repeat ×${stmt.times}`;
  if (stmt.kind === 'ifWall') return 'If wall ahead';
  return COMMAND_LABEL[stmt.kind];
}

type Props = {
  theme: Theme;
};

export function GamePanel({ theme }: Props) {
  const [levelIndex, setLevelIndex] = useState(0);
  const [program, setProgram] = useState<Statement[]>([]);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(true);

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
  }, []);

  const pickLevel = useCallback(
    (index: number) => {
      setLevelIndex(index);
      setProgram([]);
      reset();
      setMenuOpen(false);
    },
    [reset],
  );

  const run = useCallback(() => {
    const result = runProgram(level, program);
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
  }, [level, program]);

  useEffect(() => {
    if (!frames || frameIndex >= frames.length - 1) return;
    const timer = setTimeout(() => setFrameIndex((i) => i + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [frames, frameIndex]);

  const current: Frame = frames ? frames[frameIndex] : { ...level.start };
  const solved = status?.startsWith('✔') ?? false;

  const addCommand = (kind: StatementKind, path: number[]) => {
    const stmt: Statement =
      kind === 'repeat'
        ? { kind: 'repeat', times: 3, body: [] }
        : kind === 'ifWall'
          ? { kind: 'ifWall', then: [], else: [] }
          : { kind };
    setProgram((p) => insertInto(p, path, stmt));
    reset();
  };

  const removeCommand = (path: number[]) => {
    setProgram((p) => removeAt(p, path));
    reset();
  };

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

  const renderStatements = (stmts: Statement[], path: number[]): ReactNode =>
    stmts.map((stmt, i) => {
      const own = [...path, i];
      return (
        <div key={own.join('.')} style={{ margin: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontSize: 11,
                padding: '2px 6px',
                background: theme.inputBg,
                color: theme.inputText,
                border: `1px solid ${theme.divider}`,
                borderRadius: 3,
              }}
            >
              {statementLabel(stmt)}
            </span>
            <button
              type="button"
              aria-label={`Remove command ${own.join('.')}`}
              onClick={() => removeCommand(own)}
              style={{ ...buttonStyle, color: theme.deleteButton }}
            >
              ✕
            </button>
          </div>
          {stmt.kind === 'repeat' && (
            <div style={{ marginLeft: 12, borderLeft: `2px solid ${theme.divider}`, paddingLeft: 6 }}>
              {renderStatements(stmt.body, own)}
              {renderAddButtons(stmt.body.length === 0, own)}
            </div>
          )}
          {stmt.kind === 'ifWall' && (
            <>
              <div style={{ marginLeft: 12, borderLeft: `2px solid ${theme.runHighlight}`, paddingLeft: 6 }}>
                <div style={{ fontSize: 10, color: theme.buttonTextDisabled }}>then</div>
                {renderStatements(stmt.then, [...own, 0])}
                {renderAddButtons(stmt.then.length === 0, [...own, 0])}
              </div>
              <div style={{ marginLeft: 12, borderLeft: `2px solid ${theme.divider}`, paddingLeft: 6 }}>
                <div style={{ fontSize: 10, color: theme.buttonTextDisabled }}>else</div>
                {renderStatements(stmt.else, [...own, 1])}
                {renderAddButtons(stmt.else.length === 0, [...own, 1])}
              </div>
            </>
          )}
        </div>
      );
    });

  const renderAddButtons = (show: boolean, path: number[]): ReactNode => {
    if (!show && path.length === 0) return null;
    if (!show) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
        {level.allowed.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => addCommand(kind, path)}
            style={buttonStyle}
          >
            + {COMMAND_LABEL[kind]}
          </button>
        ))}
      </div>
    );
  };

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
          userSelect: 'none',
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

        {renderAddButtons(true, [])}
        {program.length > 0 && (
          <div style={{ marginTop: 6 }}>{renderStatements(program, [])}</div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button type="button" onClick={run} style={buttonStyle}>
            ▶ Run
          </button>
          <button type="button" onClick={() => { setProgram([]); reset(); }} style={buttonStyle}>
            Clear program
          </button>
        </div>

        <div style={{ fontSize: 11, marginTop: 6, minHeight: 16 }} role="status">
          {status} {solved && levelIndex < LEVELS.length - 1 && (
            <button type="button" onClick={() => pickLevel(levelIndex + 1)} style={{ ...buttonStyle, marginLeft: 6 }}>
              Next level →
            </button>
          )}
        </div>
        <div style={{ fontSize: 10, color: theme.buttonTextDisabled, marginTop: 2 }}>
          Commands: {countStatements(program)}
        </div>
      </div>
    </DraggablePanel>
  );
}
