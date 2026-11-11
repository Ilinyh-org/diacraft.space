export type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type Size = { width: number; height: number };

type WindowSize = { width: number; height: number };

function makeClamp(windowSize: WindowSize, size: Size) {
  const maxX = Math.max(0, windowSize.width - size.width);
  const maxY = Math.max(0, windowSize.height - size.height);
  return {
    x: (v: number) => Math.max(0, Math.min(maxX, v)),
    y: (v: number) => Math.max(0, Math.min(maxY, v)),
  };
}

function overlapsAny(x: number, y: number, size: Size, obstacles: Rect[]): boolean {
  return obstacles.some(
    (o) =>
      x < o.right && x + size.width > o.left && y < o.bottom && y + size.height > o.top,
  );
}



/**
 * Move one axis from `from` as far as possible toward `toward`, stopping at
 * exact border contact with any obstacle that blocks the sweep, and clamped
 * to the window. Obstacles the panel already overlaps do not limit the move
 * (so a panel that starts overlapped can still follow the cursor out).
 */
function resolveAxis(
  from: number,
  toward: number,
  other: number,
  axis: 'x' | 'y',
  size: Size,
  obstacles: Rect[],
  clamp: ReturnType<typeof makeClamp>,
): number {
  const dir = Math.sign(toward - from);
  if (dir === 0) return from;
  const w = size.width;
  const h = size.height;
  let limit = axis === 'x' ? clamp.x(toward) : clamp.y(toward);
  for (const obstacle of obstacles) {
    const lines =
      axis === 'x'
        ? { low: obstacle.left, high: obstacle.right, otherLow: obstacle.top, otherHigh: obstacle.bottom }
        : { low: obstacle.top, high: obstacle.bottom, otherLow: obstacle.left, otherHigh: obstacle.right };
    const pos = from;
    const sizeOnAxis = axis === 'x' ? w : h;
    const sizeOnOther = axis === 'x' ? h : w;
    const otherPos = other;
    // The obstacle only blocks if it overlaps on the other axis.
    if (!(otherPos < lines.otherHigh && otherPos + sizeOnOther > lines.otherLow)) continue;
    if (dir > 0) {
      if (pos + sizeOnAxis <= lines.low && limit + sizeOnAxis > lines.low) {
        limit = lines.low - sizeOnAxis;
      }
    } else if (pos >= lines.high && limit < lines.high) {
      limit = lines.high;
    }
  }
  return limit;
}

/**
 * Compute the next panel position with solid collision against obstacles and
 * the window bounds. Panels never overlap each other.
 *
 * Issue #191: the panel never jumps to a recalculated (slid/snapped) position
 * — it always moves monotonically toward the requested position.
 *
 * Issue #191 rework 4: blocking is contact-based and cursor-independent. Each
 * axis moves as far as it can toward the requested position and stops with the
 * panel's border exactly on the obstacle/window border. A fast or diagonal
 * cursor move can no longer freeze the panel: the resolved position follows
 * the border while the cursor slides along it, and is never dependent on how
 * far the cursor happens to travel in a single event.
 */
export function moveWithCollision(
  prev: { x: number; y: number },
  next: { x: number; y: number },
  size: Size,
  obstacles: Rect[],
  windowSize: WindowSize,
): { x: number; y: number } {
  const clamp = makeClamp(windowSize, size);
  let x = clamp.x(prev.x);
  let y = clamp.y(prev.y);
  const targetX = clamp.x(next.x);
  const targetY = clamp.y(next.y);
  // Resolve x, then y, then x again: repeated monotone passes let the panel
  // slide around obstacle corners while always staying collision-free when
  // the previous position was.
  for (let pass = 0; pass < 3; pass++) {
    x = resolveAxis(x, targetX, y, 'x', size, obstacles, clamp);
    y = resolveAxis(y, targetY, x, 'y', size, obstacles, clamp);
  }
  return { x, y };
}

/** Minimum window width at which a panel may center itself on first appear. */
export const PC_MIN_WIDTH = 768;

export function isPcScreen(windowSize: WindowSize): boolean {
  return windowSize.width >= PC_MIN_WIDTH;
}

/**
 * Issue #162: on a narrow (non-PC) screen the two widest menus (the main menu
 * and the game menu) must both fit on the screen. Participating panels are
 * capped at half the viewport width (minus shared margins) so the pair always
 * fits side by side; on PC screens and for non-participating panels the
 * regular full-viewport cap applies.
 */
export function panelMaxWidth(fitTwoPanels: boolean, windowSize: WindowSize): string {
  if (fitTwoPanels && !isPcScreen(windowSize)) return 'calc(50vw - 12px)';
  return 'calc(100vw - 16px)';
}

/** Position that places a panel of the given size in the window center, clamped inside the window. */
export function centeredPosition(
  size: Size,
  windowSize: WindowSize,
): { x: number; y: number } {
  const clamp = makeClamp(windowSize, size);
  return {
    x: clamp.x(Math.round((windowSize.width - size.width) / 2)),
    y: clamp.y(Math.round((windowSize.height - size.height) / 2)),
  };
}

/**
 * Resolve a panel's initial position: clamp it inside the window and, if it
 * would start on top of another panel, shift it to the nearest free slot
 * (scan down, then up, then right, then left). Issue #71.
 */
export function resolveInitialPosition(
  pos: { x: number; y: number },
  size: Size,
  obstacles: Rect[],
  windowSize: WindowSize,
): { x: number; y: number } {
  const clamp = makeClamp(windowSize, size);
  const x = clamp.x(pos.x);
  const y = clamp.y(pos.y);
  if (!overlapsAny(x, y, size, obstacles)) return { x, y };
  const step = 20;
  const candidates: Array<{ x: number; y: number }> = [];
  for (let v = 0; v <= windowSize.height; v += step) candidates.push({ x, y: v });
  for (let v = windowSize.height - size.height; v >= 0; v -= step)
    candidates.push({ x, y: v });
  for (let v = 0; v <= windowSize.width; v += step) candidates.push({ x: v, y });
  for (let v = windowSize.width - size.width; v >= 0; v -= step)
    candidates.push({ x: v, y });
  for (const c of candidates) {
    const cx = clamp.x(c.x);
    const cy = clamp.y(c.y);
    if (!overlapsAny(cx, cy, size, obstacles)) return { x: cx, y: cy };
  }
  return { x, y };
}
