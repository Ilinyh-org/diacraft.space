type Rect = {
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
 * Snap a coordinate so the panel stops exactly at the boundary of the first
 * obstacle ahead of it along one axis. Returns null if the snapped position
 * would still overlap something (fully blocked).
 */
function snapAxis(
  axis: 'x' | 'y',
  fixed: number,
  prev: number,
  next: number,
  size: Size,
  obstacles: Rect[],
  clamp: (v: number) => number,
): number | null {
  const delta = next - prev;
  if (delta === 0) return null;
  let limit = next;
  for (const o of obstacles) {
    const overlapsFixedRange =
      axis === 'x'
        ? fixed < o.bottom && fixed + size.height > o.top
        : fixed < o.right && fixed + size.width > o.left;
    if (!overlapsFixedRange) continue;
    if (delta > 0) {
      const ahead = axis === 'x' ? o.left >= prev + size.width : o.top >= prev + size.height;
      if (!ahead) continue;
      const edge = axis === 'x' ? o.left - size.width : o.top - size.height;
      limit = Math.min(limit, edge);
    } else {
      const ahead = axis === 'x' ? o.right <= prev : o.bottom <= prev;
      if (!ahead) continue;
      const edge = axis === 'x' ? o.right : o.bottom;
      limit = Math.max(limit, edge);
    }
  }
  limit = clamp(limit);
  const at = axis === 'x' ? { x: limit, y: fixed } : { x: fixed, y: limit };
  if (overlapsAny(at.x, at.y, size, obstacles)) return null;
  return limit;
}


/**
 * Compute the next panel position with solid collision against obstacles and
 * the window bounds. Panels never overlap each other: movement along one axis
 * is allowed to slide while the other axis is blocked at the obstacle's edge.
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
  // If the previous position already overlapped something, do not freeze the panel.
  if (overlapsAny(clamp.x(prev.x), clamp.y(prev.y), size, obstacles)) return { x, y };

  // Prefer sliding along the axis of the larger movement.
  const horizontalFirst = Math.abs(next.x - prev.x) >= Math.abs(next.y - prev.y);
  const tries: Array<() => { x: number; y: number } | null> = horizontalFirst
    ? [
        () => {
          const sy = snapAxis('y', x, prev.y, y, size, obstacles, clamp.y);
          return sy === null ? null : { x, y: sy };
        },
        () => {
          const sx = snapAxis('x', y, prev.x, x, size, obstacles, clamp.x);
          return sx === null ? null : { x: sx, y };
        },
      ]
    : [
        () => {
          const sx = snapAxis('x', y, prev.x, x, size, obstacles, clamp.x);
          return sx === null ? null : { x: sx, y };
        },
        () => {
          const sy = snapAxis('y', x, prev.y, y, size, obstacles, clamp.y);
          return sy === null ? null : { x, y: sy };
        },
      ];
  for (const attempt of tries) {
    const result = attempt();
    if (result) return result;
  }
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
