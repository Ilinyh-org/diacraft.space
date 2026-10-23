import type { CSSProperties } from "react";
import { DraggablePanel } from "../../ui/DraggablePanel";
import type { Theme, ThemeName } from "../../theme";
import { LANGUAGES, t, type LanguageCode } from "./i18n";

export type MenuId = "palette" | "export" | "algorithm" | "game" | "feedback";

export type { MenuVisibility } from "./menuVisibility";
export { INITIAL_MENU_VISIBILITY } from "./menuVisibility";
export { LANGUAGES, type LanguageCode } from "./i18n";
import type { MenuVisibility } from "./menuVisibility";

const MENU_KEYS: { id: MenuId; key: Parameters<typeof t>[1] }[] = [
  { id: "palette", key: "menu.palette" },
  { id: "export", key: "menu.export" },
  { id: "algorithm", key: "menu.algorithm" },
  { id: "game", key: "menu.game" },
  { id: "feedback", key: "menu.feedback" },
];

type MainMenuProps = {
  theme: Theme;
  visibility: MenuVisibility;
  onToggle: (id: MenuId) => void;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  themeName: ThemeName;
  onToggleTheme: () => void;
};

export function MainMenu({
  theme,
  visibility,
  onToggle,
  language,
  onLanguageChange,
  themeName,
  onToggleTheme,
}: MainMenuProps) {
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

  const selectStyle: CSSProperties = {
    padding: "4px 6px",
    border: `1px solid ${theme.buttonBorder}`,
    borderRadius: 4,
    background: theme.inputBg,
    color: theme.inputText,
    cursor: "pointer",
    fontSize: 13,
  };

  return (
    <DraggablePanel
      theme={theme}
      initialPosition={{ x: 10, y: 10 }}
      storageKey="diacraft-panel-pos-main"
    >
      <div
        data-testid="main-menu"
        style={{ display: "flex", flexDirection: "column", gap: 4 }}
      >
        <div
          data-testid="main-menu-theme"
          onPointerDown={(e) => {
            e.preventDefault();
            onToggleTheme();
          }}
          style={{ ...buttonStyle(false), fontWeight: 600 }}
        >
          {themeName === "dark" ? "☀️ Light" : "🌙 Dark"}
        </div>
        <div
          data-testid="main-menu-language-row"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <label
            htmlFor="main-menu-language"
            style={{ fontSize: 13, color: theme.buttonText }}
          >
            {t(language, "menu.language")}
          </label>
          <select
            id="main-menu-language"
            data-testid="main-menu-language"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
            style={selectStyle}
          >
            {LANGUAGES.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {MENU_KEYS.map(({ id, key }) => (
          <div
            key={id}
            data-testid={`main-menu-${id}`}
            onPointerDown={(e) => {
              e.preventDefault();
              onToggle(id);
            }}
            style={buttonStyle(visibility[id])}
          >
            {t(language, key)}
          </div>
        ))}
      </div>
    </DraggablePanel>
  );
}
