import { useState, useRef } from 'react';
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

function clampToWindow(
  pos: { x: number; y: number },
  panelWidth: number,
  panelHeight: number
): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - panelWidth);
  const maxY = Math.max(0, window.innerHeight - panelHeight);
  return {
    x: Math.max(0, Math.min(maxX, pos.x)),
    y: Math.max(0, Math.min(maxY, pos.y)),
  };
}

/** Push a rect out of any overlapping obstacle rect along the least-penetration axis. */
function resolveOverlap(rect: Rect, obstacle: Rect) {
  const overlapX =
    Math.min(rect.right, obstacle.right) -
    Math.max(rect.left, obstacle.left);
  const overlapY =
    Math.min(rect.bottom, obstacle.bottom) -
    Math.max(rect.top, obstacle.top);
  if (overlapX <= 0 || overlapY <= 0) return;
  if (overlapX < overlapY) {
    const push =
      (rect.left + rect.right) / 2 < (obstacle.left + obstacle.right) / 2
        ? -overlapX
        : overlapX;
    rect.left += push;
    rect.right += push;
  } else {
    const push =
      (rect.top + rect.bottom) / 2 < (obstacle.top + obstacle.bottom) / 2
        ? -overlapY
        : overlapY;
    rect.top += push;
    rect.bottom += push;
  }
}

type Props = {
  theme: Theme;
  initialPosition: { x: number; y: number };
  width?: number;
  children: ReactNode;
};

export function DraggablePanel({ theme, initialPosition, width, children }: Props) {
  const [pos, setPos] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    panelX: number;
    panelY: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
    let next = clampToWindow(
      {
        x: dragRef.current.panelX + dx,
        y: dragRef.current.panelY + dy,
      },
      panelWidth,
      panelHeight
    );

    if (panelEl && panelWidth > 0 && panelHeight > 0) {
      const rect: Rect = {
        left: next.x,
        top: next.y,
        right: next.x + panelWidth,
        bottom: next.y + panelHeight,
      };
      const others = Array.from(
        document.querySelectorAll<HTMLElement>(`.${PANEL_CLASS}`)
      ).filter((el) => el !== panelEl);
      for (const other of others) {
        const or = other.getBoundingClientRect();
        if (or.width <= 0 || or.height <= 0) continue;
        resolveOverlap(rect, {
          left: or.left,
          top: or.top,
          right: or.right,
          bottom: or.bottom,
        });
      }
      next = clampToWindow(
        { x: rect.left, y: rect.top },
        panelWidth,
        panelHeight
      );
    }
    setPos(next);
  };

  const onHandlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
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
