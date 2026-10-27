import type { LanguageCode } from '../canvas/ui/i18n';

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
  | 'call';

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
  | { kind: 'call'; name: string };

export type Subprograms = Record<string, Statement[]>;

export type Pos = { x: number; y: number };

export type LevelConcept =
  | 'linear'
  | 'conditions'
  | 'loops'
  | 'functions'
  | 'arrays';

export type Level = {
  id: string;
  title: string;
  concept: LevelConcept;
  description: string;
  width: number;
  height: number;
  /** Wall cells as [x, y] pairs. */
  walls: [number, number][];
  /** Issue #142: door cells as [x, y] pairs — closed until the password is entered. */
  doors?: [number, number][];
  /** Issue #142: the password that opens this level's doors (level task text). */
  password?: string;
  /**
   * Issue #149: the exact name the level task demands for the input block
   * (e.g. "Input Password" instead of the default "Input").
   */
  inputName?: string;
  /**
   * Issue #167: the expected input-block name for each interface language
   * (e.g. "Input Password" in English, «Ввод пароля» in Russian). Any of
   * the listed names satisfies the level task.
   */
  inputNames?: Partial<Record<LanguageCode, string>>;
  start: Pos & { dir: Dir };
  goal: Pos;
  allowed: StatementKind[];
  /** Collectible items as [x, y] pairs (inventory rows). */
  items?: [number, number][];
};

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

  const itemAt = (x: number, y: number): string | null => {
    const found = (level.items ?? []).some(([ix, iy]) => ix === x && iy === y);
    return found ? `item(${x},${y})` : null;
  };

  const resolveOut = (text: string): string =>
    text
      .replace(/inv\[(\d+)\]/g, (_, i) => inventory[Number(i)] ?? '?')
      .replace(/\bpos\b/g, `(${frame.x}, ${frame.y})`);

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
