import { useEffect, useRef } from 'react';
import type { Theme } from '../../theme';

export type ContextMenuItem = {
  label: string;
  disabled?: boolean;
  onSelect: () => void;
};

type ContextMenuProps = {
  theme: Theme;
  /** Viewport (client) coordinates where the menu should appear. */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export function ContextMenu({ theme, x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      const menu = ref.current;
      const target = e.target;
      if (!menu || !(target instanceof Node) || !menu.contains(target))
        onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      data-testid="context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1100,
        minWidth: 140,
        padding: 4,
        background: theme.panelBg,
        border: `1px solid ${theme.buttonBorder}`,
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          style={{
            padding: '6px 10px',
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: item.disabled ? theme.buttonTextDisabled : theme.buttonText,
            textAlign: 'left',
            fontSize: 13,
            cursor: item.disabled ? 'default' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) e.currentTarget.style.background = theme.buttonBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
