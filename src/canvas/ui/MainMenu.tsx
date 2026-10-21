import type { CSSProperties } from "react";
import { DraggablePanel } from "../../ui/DraggablePanel";
import type { Theme } from "../../theme";

export type MenuId = "palette" | "export" | "algorithm" | "game" | "feedback";

export type { MenuVisibility } from "./menuVisibility";
export { INITIAL_MENU_VISIBILITY } from "./menuVisibility";
import type { MenuVisibility } from "./menuVisibility";

const MENU_LABELS: { id: MenuId; label: string }[] = [
  { id: "palette", label: "Palette" },
  { id: "export", label: "Export/Import" },
  { id: "algorithm", label: "Animation" },
  { id: "game", label: "Game" },
  { id: "feedback", label: "Feedback" },
];

type MainMenuProps = {
  theme: Theme;
  visibility: MenuVisibility;
  onToggle: (id: MenuId) => void;
};

export function MainMenu({ theme, visibility, onToggle }: MainMenuProps) {
  const buttonStyle = (active: boolean): CSSProperties => ({
    padding: "6px 10px",
    border: `1px solid ${theme.buttonBorder}`,
    borderRadius: 4,
    background: active ? theme.selection : theme.buttonBg,
    color: active ? "#ffffff" : theme.buttonText,
    cursor: "pointer",
    fontSize: 13,
    textAlign: "center",
  });

  return (
    <DraggablePanel theme={theme} initialPosition={{ x: 10, y: 10 }}>
      <div
        data-testid="main-menu"
        style={{ display: "flex", flexDirection: "column", gap: 4 }}
      >
        {MENU_LABELS.map(({ id, label }) => (
          <div
            key={id}
            data-testid={`main-menu-${id}`}
            onPointerDown={(e) => {
              e.preventDefault();
              onToggle(id);
            }}
            style={buttonStyle(visibility[id])}
          >
            {label}
          </div>
        ))}
      </div>
    </DraggablePanel>
  );
}
