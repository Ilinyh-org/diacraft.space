
export type Dir = 0 | 1 | 2 | 3; // 0 = up, 1 = right, 2 = down, 3 = left

export type StatementKind =
  | 'move'
  | 'turnLeft'
  | 'turnRight'
  | 'repeat'
  | 'ifWall'
  | 'output'
  | 'inputDir'
  | 'setInv'
  | 'call'
  /** Issue #171: action block `read`: prints the sign text on the current cell. */
  | 'read'
  /** Issue #171: action block `open`: opens the box on the current cell. */
  | 'open';

export type Statement =
  | { kind: 'move' }
  | { kind: 'turnLeft' }
  | { kind: 'turnRight' }
  | { kind: 'repeat'; times: number; body: Statement[] }
  | { kind: 'ifWall'; then: Statement[]; else: Statement[] }
  /** I/O block: prints text (`pos` → coordinates, `inv[n]` → slot value). */
  | { kind: 'output'; text: string }
  /** I/O block: the player steers the robot with a direction from the menu. */
  | { kind: 'inputDir' }
  /** Action block `inv[n] = item`: picks up the item at the current cell. */
  | { kind: 'setInv'; index: number }
  /** Function block: calls a named subprogram flowchart. */
  | { kind: 'call'; name: string }
  /** Issue #171: action block `read`: prints the sign text on the current cell. */
  | { kind: 'read' }
  /** Issue #171: action block `open`: opens the box on the current cell so
   * its item can be picked up with `inv[n] = item`. */
  | { kind: 'open' };

/** Issue #171: a readable sign placed on a cell. */
export type Sign = { at: [number, number]; text: string };

/** Issue #171: a box placed on a cell; opening it reveals its item. */
export type Box = { at: [number, number]; item: string };

export type Subprograms = Record<string, Statement[]>;

export type Pos = { x: number; y: number };

export type LevelConcept =
  | 'linear'
  | 'conditions'
  | 'loops'
  | 'functions'
  | 'arrays';

export interface Level {
  id: string;
  name: Partial<Record<string, string>>;
  label: string;
  concept: LevelConcept;
  description: Partial<Record<string, string>>;
  width: number;
  height: number;
  walls: [number, number][];
  start: { x: number; y: number; dir: Dir };
  goal: { x: number; y: number };
  allowed: StatementKind[];
  doors?: [number, number][];
  items?: [number, number][];
  password?: string;
  inputName?: string;
  inputNames?: Partial<Record<string, string>>;
  usesIo?: boolean;
  signs?: { at: [number, number]; text: string }[];
  boxes?: { at: [number, number]; item: string }[];
}


export type Frame = Pos & { dir: Dir };

export type RunStatus = 'win' | 'missed' | 'crash' | 'timeout' | 'needInput';

export type RunResult = {
  status: RunStatus;
  frames: Frame[];
  steps: number;
  /** Lines printed by i/o blocks during the run. */
  output: string[];
};

export const MAX_STEPS = 1000;

const DELTA: Record<Dir, Pos> = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
};

export function isWallAt(level: Level, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return true;
  return level.walls.some(([wx, wy]) => wx === x && wy === y);
}

/** Issue #171: the sign placed on this cell, if any. */
export function signAt(level: Level, x: number, y: number): Sign | undefined {
  return (level.signs ?? []).find((s) => s.at[0] === x && s.at[1] === y);
}

/** Issue #171: the box placed on this cell, if any. */
export function boxAt(level: Level, x: number, y: number): Box | undefined {
  return (level.boxes ?? []).find((b) => b.at[0] === x && b.at[1] === y);
}

/** Issue #142: is the cell one of the level's password doors? */
export function isDoorAt(level: Level, x: number, y: number): boolean {
  return (level.doors ?? []).some(([dx, dy]) => dx === x && dy === y);
}

/**
 * Issue #142: a cell blocks the robot when it is a wall, or a door that is
 * not (yet) open. Open doors are tracked as "x,y" keys.
 */
export function isBlockedAt(
  level: Level,
  x: number,
  y: number,
  openDoors: ReadonlySet<string> = new Set(),
): boolean {
  if (isWallAt(level, x, y)) return true;
  if (isDoorAt(level, x, y) && !openDoors.has(`${x},${y}`)) return true;
  return false;
}

export function wallAhead(level: Level, frame: Frame): boolean {
  const d = DELTA[frame.dir];
  return isWallAt(level, frame.x + d.x, frame.y + d.y);
}

/**
 * Applies a single statement to a frame without touching the run history
 * (issue #40). Used to synchronize the built-in game with the diagram
 * animation: one activated block advances the robot by one statement.
 * Movement into a wall reports `crashed` and leaves the frame unchanged.
 */
export function stepStatement(
  level: Level,
  frame: Frame,
  stmt: Statement,
  openDoors: ReadonlySet<string> = new Set(),
): { frame: Frame; crashed: boolean } {
  switch (stmt.kind) {
    case 'move': {
      const d = DELTA[frame.dir];
      const nx = frame.x + d.x;
      const ny = frame.y + d.y;
      if (isBlockedAt(level, nx, ny, openDoors)) {
        return { frame, crashed: true };
      }
      return { frame: { x: nx, y: ny, dir: frame.dir }, crashed: false };
    }
    case 'turnLeft':
      return { frame: { ...frame, dir: ((frame.dir + 3) % 4) as Dir }, crashed: false };
    case 'turnRight':
      return { frame: { ...frame, dir: ((frame.dir + 1) % 4) as Dir }, crashed: false };
    default:
      return { frame, crashed: false };
  }
}

/**
 * Interprets the program against a level. Returns the full frame history so the
 * UI can animate the run. Bumping into a wall ends the run immediately.
 */
export function runProgram(
  level: Level,
  program: Statement[],
  subprograms: Subprograms = {},
  inputs: Dir[] = [],
  passwords: string[] = [],
): RunResult {
  let frame: Frame = { ...level.start };
  const frames: Frame[] = [{ ...frame }];
  const output: string[] = [];
  const inventory: (string | null)[] = Array(8).fill(null);
  let inputIndex = 0;
  let passwordIndex = 0;
  // Issue #142: doors start closed; the correct password opens all of them.
  const openDoors = new Set<string>();
  let needInput = false;
  let steps = 0;
  let crashed = false;
  const callStack = new Set<string>();

  const openedBoxes = new Set<string>();
  /** Issue #171: the text of the last sign read with a `read` block. */
  let lastSign = '';

  const itemAt = (x: number, y: number): string | null => {
    if ((level.items ?? []).some(([ix, iy]) => ix === x && iy === y)) {
      return `item(${x},${y})`;
    }
    // Issue #171: an opened box's item becomes collectible like a floor item.
    if (openedBoxes.has(`${x},${y}`)) return boxAt(level, x, y)?.item ?? null;
    return null;
  };

  const resolveOut = (text: string): string =>
    text
      .replace(/inv\[(\d+)\]/g, (_, i) => inventory[Number(i)] ?? '?')
      .replace(/\bpos\b/g, `(${frame.x}, ${frame.y})`)
      // Issue #171: `sign` resolves to the last text read with a read block.
      .replace(/\bsign\b/g, lastSign);

  const exec = (stmts: Statement[]): void => {
    for (const stmt of stmts) {
      if (crashed || needInput || steps >= MAX_STEPS) return;
      steps += 1;
      switch (stmt.kind) {
        case 'move': {
          const d = DELTA[frame.dir];
          const nx = frame.x + d.x;
          const ny = frame.y + d.y;
          if (isBlockedAt(level, nx, ny, openDoors)) {
            crashed = true;
            return;
          }
          frame = { x: nx, y: ny, dir: frame.dir };
          frames.push({ ...frame });
          break;
        }
        case 'turnLeft':
          frame = { ...frame, dir: ((frame.dir + 3) % 4) as Dir };
          frames.push({ ...frame });
          break;
        case 'turnRight':
          frame = { ...frame, dir: ((frame.dir + 1) % 4) as Dir };
          frames.push({ ...frame });
          break;
        case 'repeat':
          for (let i = 0; i < stmt.times; i += 1) {
            exec(stmt.body);
            if (crashed || needInput || steps >= MAX_STEPS) return;
          }
          break;
        case 'ifWall':
          exec(wallAhead(level, frame) ? stmt.then : stmt.else);
          break;
        case 'output':
          output.push(resolveOut(stmt.text));
          break;
        case 'inputDir':
          // Issue #142: on password-door levels the input block feeds the
          // door password instead of a direction.
          if (level.password != null) {
            const pw = (passwords[passwordIndex] ?? '').trim().toLowerCase();
            passwordIndex += 1;
            if (pw === level.password.trim().toLowerCase()) {
              for (const [dx, dy] of level.doors ?? []) openDoors.add(`${dx},${dy}`);
            } else {
              crashed = true;
              return;
            }
            break;
          }
          if (inputIndex >= inputs.length) {
            needInput = true;
            return;
          }
          frame = { ...frame, dir: inputs[inputIndex] };
          inputIndex += 1;
          frames.push({ ...frame });
          break;
        case 'setInv':
          inventory[stmt.index] = itemAt(frame.x, frame.y);
          break;
        case 'read': {
          // Issue #171: reading a sign prints its text; the text is kept so
          // later output blocks can reference it as `sign`.
          const sign = signAt(level, frame.x, frame.y);
          if (sign) {
            lastSign = sign.text;
            output.push(sign.text);
          }
          break;
        }
        case 'open': {
          // Issue #171: opening a box makes its item collectible with
          // `inv[n] = item` on the same cell.
          if (boxAt(level, frame.x, frame.y)) openedBoxes.add(`${frame.x},${frame.y}`);
          break;
        }
        case 'call': {
          const body = subprograms[stmt.name];
          if (!body) break;
          if (callStack.has(stmt.name)) {
            crashed = true; // runaway recursion
            return;
          }
          callStack.add(stmt.name);
          exec(body);
          callStack.delete(stmt.name);
          break;
        }
      }
    }
  };

  exec(program);

  const status: RunStatus = crashed
    ? 'crash'
    : steps >= MAX_STEPS
      ? 'timeout'
      : needInput
        ? 'needInput'
        : frame.x === level.goal.x && frame.y === level.goal.y
          ? 'win'
          : 'missed';
  return { status, frames, steps, output };
}
