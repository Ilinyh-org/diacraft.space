import { useState, useRef, useLayoutEffect } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import type { Theme } from '../theme';
import { centeredPosition, isPcScreen, panelMaxWidth, moveWithCollision, resolveInitialPosition } from './panelPositioning';

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
  /**
   * Issue #162: when true, the panel participates in the two-widest-menus
   * rule — on a narrow screen it is capped at half the viewport width so
   * that it and the other participating panel always fit on the screen.
   */
  fitTwoPanels?: boolean;
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

export function DraggablePanel({ theme, initialPosition, width, storageKey, center, fitTwoPanels, children }: Props) {
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
  const contentRef = useRef<HTMLDivElement>(null);
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

  const shouldDragFrom = (e: React.PointerEvent): boolean => {
    // Issue #143: the panel can be dragged from any empty space — the panel
    // background, the content wrapper's padding/gaps, or the top handle — but
    // never from interactive elements or content inside them (buttons, text
    // nodes, inputs, etc.).
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a, label, [data-no-drag]')) {
      return false;
    }
    return (
      target === panelRef.current ||
      target === contentRef.current ||
      target.closest('[data-drag-handle]') !== null
    );
  };

  const onPanelPointerDown = (e: React.PointerEvent) => {
    if (!shouldDragFrom(e)) return;
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

  const onPanelPointerMove = (e: React.PointerEvent) => {
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

  const onPanelPointerUp = (e: React.PointerEvent) => {
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
    maxWidth: panelMaxWidth(fitTwoPanels === true, {
      width: window.innerWidth,
      height: window.innerHeight,
    }),
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
    <div
      ref={panelRef}
      className={PANEL_CLASS}
      style={{ ...style, cursor: dragging ? 'grabbing' : style.cursor }}
      onPointerDown={onPanelPointerDown}
      onPointerMove={onPanelPointerMove}
      onPointerUp={onPanelPointerUp}
      onPointerCancel={onPanelPointerUp}
    >
      <div data-drag-handle style={handleStyle}>
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
        ref={contentRef}
        style={{
          padding: '0 8px 8px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          cursor: 'default',
        }}
      >
        {children}
      </div>
    </div>
  );
}
