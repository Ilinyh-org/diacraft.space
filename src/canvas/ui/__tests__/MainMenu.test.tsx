import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainMenu } from "../MainMenu";
import {
  INITIAL_MENU_VISIBILITY,
  type MenuVisibility,
} from "../menuVisibility";
import { lightTheme } from "../../../theme";

describe("MainMenu", () => {
  it("renders a toggle button for every menu", () => {
    render(
      <MainMenu
        theme={lightTheme}
        visibility={INITIAL_MENU_VISIBILITY}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId("main-menu")).toBeInTheDocument();
    for (const id of [
      "palette",
      "export",
      "algorithm",
      "game",
      "feedback",
    ] as const) {
      expect(screen.getByTestId(`main-menu-${id}`)).toBeInTheDocument();
    }
  });

  it("starts with only the palette visible", () => {
    expect(INITIAL_MENU_VISIBILITY).toEqual({
      palette: true,
      export: false,
      algorithm: false,
      game: false,
      feedback: false,
    });
  });

  it("toggles a menu on click", () => {
    const onToggle = vi.fn();
    const visibility: MenuVisibility = {
      ...INITIAL_MENU_VISIBILITY,
      export: true,
    };
    render(
      <MainMenu
        theme={lightTheme}
        visibility={visibility}
        onToggle={onToggle}
      />,
    );
    fireEvent.pointerDown(screen.getByTestId("main-menu-export"));
    expect(onToggle).toHaveBeenCalledWith("export");
    fireEvent.pointerDown(screen.getByTestId("main-menu-palette"));
    expect(onToggle).toHaveBeenCalledWith("palette");
  });
});
