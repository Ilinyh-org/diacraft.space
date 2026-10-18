export type Dir = 0 | 1 | 2 | 3; // 0 = up, 1 = right, 2 = down, 3 = left

export type StatementKind =
  | 'move'
  | 'turnLeft'
  | 'turnRight'
  | 'repeat'
  | 'ifWall';

export type Statement =
  | { kind: 'move' }
  | { kind: 'turnLeft' }
  | { kind: 'turnRight' }
  | { kind: 'repeat'; times: number; body: Statement[] }
  | { kind: 'ifWall'; then: Statement[]; else: Statement[] };

export type Pos = { x: number; y: number };

export type LevelConcept = 'linear' | 'conditions' | 'loops' | 'combined';

export type Level = {
  id: string;
  title: string;
  concept: LevelConcept;
  description: string;
  width: number;
  height: number;
  /** Wall cells as [x, y] pairs. */
  walls: [number, number][];
  start: Pos & { dir: Dir };
  goal: Pos;
  allowed: StatementKind[];
};

export type Frame = Pos & { dir: Dir };

export type RunStatus = 'win' | 'missed' | 'crash' | 'timeout';

export type RunResult = {
  status: RunStatus;
  frames: Frame[];
  steps: number;
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

export function wallAhead(level: Level, frame: Frame): boolean {
  const d = DELTA[frame.dir];
  return isWallAt(level, frame.x + d.x, frame.y + d.y);
}

/**
 * Interprets the program against a level. Returns the full frame history so the
 * UI can animate the run. Bumping into a wall ends the run immediately.
 */
export function runProgram(level: Level, program: Statement[]): RunResult {
  let frame: Frame = { ...level.start };
  const frames: Frame[] = [{ ...frame }];
  let steps = 0;
  let crashed = false;

  const exec = (stmts: Statement[]): void => {
    for (const stmt of stmts) {
      if (crashed || steps >= MAX_STEPS) return;
      steps += 1;
      switch (stmt.kind) {
        case 'move': {
          const d = DELTA[frame.dir];
          const nx = frame.x + d.x;
          const ny = frame.y + d.y;
          if (isWallAt(level, nx, ny)) {
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
            if (crashed || steps >= MAX_STEPS) return;
          }
          break;
        case 'ifWall':
          exec(wallAhead(level, frame) ? stmt.then : stmt.else);
          break;
      }
    }
  };

  exec(program);

  const status: RunStatus = crashed
    ? 'crash'
    : steps >= MAX_STEPS
      ? 'timeout'
      : frame.x === level.goal.x && frame.y === level.goal.y
        ? 'win'
        : 'missed';
  return { status, frames, steps };
}
