import { useState, useRef, useLayoutEffect } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import type { Theme } from '../theme';

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** Shared class so panels can detect each other for collision. */
export const PANEL_CLASS = 'draggable-panel';

function clampX(v: number, panelWidth: number): number {
  const maxX = Math.max(0, window.innerWidth - panelWidth);
  return Math.max(0, Math.min(maxX, v));
}

function clampY(v: number, panelHeight: number): number {
  const maxY = Math.max(0, window.innerHeight - panelHeight);
  return Math.max(0, Math.min(maxY, v));
}

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

/**
 * Minimum window width at which a panel may center itself on first appear.
 * Anything narrower is treated as a mobile/small screen (issue #81).
 */
export const PC_MIN_WIDTH = 768;

export function isPcScreen(windowSize: WindowSize): boolean {
  return windowSize.width >= PC_MIN_WIDTH;
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

type Props = {
  theme: Theme;
  initialPosition: { x: number; y: number };
  width?: number;
  /**
   * When true and the current window is PC-sized, the panel first appears
   * centered on the screen instead of at `initialPosition` (issue #81).
   */
  center?: boolean;
  /**
   * When set, the panel's position is restored from localStorage on mount and
   * saved there after each drag, so the panel reappears where it was last
   * placed even after being hidden and reshown. Issue #75.
   */
  storageKey?: string;
  children: ReactNode;
};

function loadSavedPosition(key: string): { x: number; y: number } | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { x?: unknown }).x === 'number' &&
      typeof (parsed as { y?: unknown }).y === 'number' &&
      Number.isFinite((parsed as { x: number }).x) &&
      Number.isFinite((parsed as { y: number }).y)
    ) {
      return { x: (parsed as { x: number }).x, y: (parsed as { y: number }).y };
    }
  } catch {
    // ignore parse/quota errors
  }
  return null;
}

function savePosition(key: string, pos: { x: number; y: number }) {
  try {
    window.localStorage.setItem(key, JSON.stringify(pos));
  } catch {
    // ignore quota / privacy errors
  }
}

export function DraggablePanel({ theme, initialPosition, width, storageKey, center, children }: Props) {
  const saved = storageKey ? loadSavedPosition(storageKey) : null;
  const [pos, setPos] = useState(() => saved ?? initialPosition);
  // Issue #100: the panel stays hidden until its first-appearance adjustment
  // (clamping/centering/overlap shift) has run in a layout effect, so the
  // browser never paints the fallback position followed by a jump.
  const [placed, setPlaced] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    panelX: number;
    panelY: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const adjustedRef = useRef(false);

  // Clamp the initial position inside the window and shift it out of overlap
  // with already-mounted panels (issue #71). Runs as a layout effect so the
  // corrected position is committed before the first paint (issue #100).
  useLayoutEffect(() => {
    if (adjustedRef.current) return;
    adjustedRef.current = true;
    const el = panelRef.current;
    const panelWidth = el?.offsetWidth ?? 0;
    const panelHeight = el?.offsetHeight ?? 0;
    if (!el || panelWidth <= 0 || panelHeight <= 0) {
      // Nothing to measure (e.g. no layout available): show at initial pos.
      setPlaced(true);
      return;
    }
    const others = Array.from(
      document.querySelectorAll<HTMLElement>(`.${PANEL_CLASS}`),
    ).filter((o) => o !== el);
    const obstacles: Rect[] = [];
    for (const other of others) {
      const or = other.getBoundingClientRect();
      if (or.width <= 0 || or.height <= 0) continue;
      obstacles.push({ left: or.left, top: or.top, right: or.right, bottom: or.bottom });
    }
    const windowSize = { width: window.innerWidth, height: window.innerHeight };
    // Issue #100: centering applies only to the very first appearance. A
    // position remembered from a previous session always wins.
    const desired = center && isPcScreen(windowSize) && !saved
      ? centeredPosition({ width: panelWidth, height: panelHeight }, windowSize)
      : pos;
    setPos(
      resolveInitialPosition(
        desired,
        { width: panelWidth, height: panelHeight },
        obstacles,
        windowSize,
      ),
    );
    setPlaced(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onHandlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panelX: pos.x,
      panelY: pos.y,
    };
    setDragging(true);
  };

  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const panelEl = panelRef.current;
    const panelWidth = panelEl?.offsetWidth ?? 0;
    const panelHeight = panelEl?.offsetHeight ?? 0;
    let next = {
      x: dragRef.current.panelX + dx,
      y: dragRef.current.panelY + dy,
    };
    if (panelEl && panelWidth > 0 && panelHeight > 0) {
      const others = Array.from(
        document.querySelectorAll<HTMLElement>(`.${PANEL_CLASS}`)
      ).filter((el) => el !== panelEl);
      const obstacles: Rect[] = [];
      for (const other of others) {
        const or = other.getBoundingClientRect();
        if (or.width <= 0 || or.height <= 0) continue;
        obstacles.push({
          left: or.left,
          top: or.top,
          right: or.right,
          bottom: or.bottom,
        });
      }
      next = moveWithCollision(
        { x: dragRef.current.panelX, y: dragRef.current.panelY },
        next,
        { width: panelWidth, height: panelHeight },
        obstacles,
        { width: window.innerWidth, height: window.innerHeight }
      );
    } else {
      next = {
        x: clampX(next.x, panelWidth),
        y: clampY(next.y, panelHeight),
      };
    }
    setPos(next);
  };

  const onHandlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (storageKey) savePosition(storageKey, pos);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const style: CSSProperties = {
    position: 'absolute',
    left: pos.x,
    top: pos.y,
    width,
    maxWidth: 'calc(100vw - 16px)',
    background: theme.panelBg,
    borderRadius: 6,
    boxShadow: dragging
      ? `0 6px 16px ${theme.panelShadow}`
      : `0 2px 6px ${theme.panelShadow}`,
    display: 'flex',
    flexDirection: 'column',
    userSelect: 'none',
    touchAction: 'none',
    visibility: placed ? 'visible' : 'hidden',
    zIndex: dragging ? 1000 : 100,
  };

  const handleStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '6px 0',
    cursor: dragging ? 'grabbing' : 'grab',
    touchAction: 'none',
    userSelect: 'none',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  };

  return (
    <div ref={panelRef} className={PANEL_CLASS} style={style}>
      <div
        style={handleStyle}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      >
        <div
          style={{
            width: 32,
            height: 3,
            borderRadius: 2,
            background: theme.buttonTextDisabled,
            opacity: 0.6,
          }}
        />
      </div>
      <div
        style={{
          padding: '0 8px 8px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {children}
      </div>
    </div>
  );
}
