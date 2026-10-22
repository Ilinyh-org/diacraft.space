import type { CSSProperties } from "react";
import { DraggablePanel } from "../../ui/DraggablePanel";
import type { Theme } from "../../theme";
import { PALETTE } from "../constants";
import type { BlockType } from "../Blocks/Block";
import { t, type LanguageCode, type TranslationKey } from "./i18n";

type PaletteProps = {
  theme: Theme;
  isDrawMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToggleMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPalettePointerDown: (e: React.PointerEvent, type: BlockType) => void;
  onClear: () => void;
  language: LanguageCode;
};

export function Palette({
  theme,
  isDrawMode,
  canUndo,
  canRedo,
  onToggleMode,
  onUndo,
  onRedo,
  onPalettePointerDown,
  onClear,
  language,
}: PaletteProps) {
  const smallButton = (enabled: boolean): CSSProperties => ({
    padding: "6px 8px",
    border: `1px solid ${theme.buttonBorder}`,
    borderRadius: 4,
    background: enabled ? theme.buttonBg : theme.buttonBgDisabled,
    color: enabled ? theme.buttonText : theme.buttonTextDisabled,
    cursor: enabled ? "pointer" : "default",
    fontSize: 13,
    textAlign: "center",
    whiteSpace: "nowrap",
  });

  const paletteItemStyle: CSSProperties = {
    padding: "6px 10px",
    border: `1px solid ${theme.buttonBorder}`,
    borderRadius: 4,
    background: theme.buttonBg,
    color: theme.buttonText,
    cursor: "grab",
    fontSize: 13,
    textAlign: "center",
  };

  return (
    // Positioned below the always-visible main menu (issue #31).
    <DraggablePanel theme={theme} initialPosition={{ x: 10, y: 230 }} storageKey="diacraft-panel-pos-palette">
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          onToggleMode();
        }}
        style={{
          padding: "6px 10px",
          border: `1px solid ${theme.buttonBorder}`,
          borderRadius: 4,
          background: isDrawMode ? theme.selection : theme.buttonBg,
          color: isDrawMode ? "#ffffff" : theme.buttonText,
          cursor: "pointer",
          fontSize: 13,
          textAlign: "center",
          fontWeight: 600,
        }}
      >
        {isDrawMode
          ? t(language, "palette.draw")
          : t(language, "palette.select")}
      </div>

      <div style={{ display: "flex", gap: 4 }}>
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            if (canUndo) onUndo();
          }}
          style={{ ...smallButton(canUndo), flex: 1 }}
        >
          {t(language, "palette.undo")}
        </div>
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            if (canRedo) onRedo();
          }}
          style={{ ...smallButton(canRedo), flex: 1 }}
        >
          {t(language, "palette.redo")}
        </div>
      </div>

      {!isDrawMode && (
        <>
          <div
            style={{
              height: 1,
              background: theme.divider,
              margin: "4px 0",
            }}
          />
          {PALETTE.map((item) => (
            <div
              key={item.type}
              onPointerDown={(e) => onPalettePointerDown(e, item.type)}
              style={paletteItemStyle}
            >
              {t(language, BLOCK_LABEL_KEY[item.type])}
            </div>
          ))}
        </>
      )}

      <div style={{ height: 1, background: theme.divider, margin: '4px 0' }} />

      {/* Clear moved here from the export panel (issue #45). */}
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          onClear();
        }}
        style={{
          ...paletteItemStyle,
          color: theme.deleteButton,
          borderColor: theme.deleteButton,
          cursor: 'pointer',
        }}
      >
        {t(language, "palette.clear")}
      </div>
    </DraggablePanel>
  );
}

const BLOCK_LABEL_KEY: Record<BlockType, TranslationKey> = {
  start: "block.startEnd",
  action: "block.action",
  condition: "block.condition",
  io: "block.io",
  forloop: "block.forloop",
  function: "block.function",
  link: "block.link",
};
