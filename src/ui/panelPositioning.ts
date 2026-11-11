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
 * Compute the next panel position with solid collision against obstacles and
 * the window bounds. Panels never overlap each other. Issue #191: when the
 * requested position is blocked, the panel keeps its last valid position —
 * it never jumps to a recalculated (slid/snapped) position.
 */
export function moveWithCollision(
  prev: { x: number; y: number },
  next: { x: number; y: number },
  size: Size,
  obstacles: Rect[],
  windowSize: WindowSize,
): { x: number; y: number } {
  const clamp = makeClamp(windowSize, size);
  const x = clamp.x(next.x);
  const y = clamp.y(next.y);
  if (!overlapsAny(x, y, size, obstacles)) return { x, y };
  // Blocked (issue #191): stay at the last valid position instead of
  // recalculating — the menu must not jump.
  return { x: clamp.x(prev.x), y: clamp.y(prev.y) };
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
