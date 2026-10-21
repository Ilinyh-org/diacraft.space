import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MainMenu } from "../MainMenu";
import {
  INITIAL_MENU_VISIBILITY,
} from "../menuVisibility";
import { lightTheme } from "../../../theme";

function renderMenu(overrides?: { language?: "en" | "ru" }) {
  const onToggle = vi.fn();
  const onLanguageChange = vi.fn();
  render(
    <MainMenu
      theme={lightTheme}
      visibility={INITIAL_MENU_VISIBILITY}
      onToggle={onToggle}
      language={overrides?.language ?? "en"}
      onLanguageChange={onLanguageChange}
    />,
  );
  return { onToggle, onLanguageChange };
}

describe("MainMenu language selection (issue #62)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows a language drop-down at the top of the main menu", () => {
    renderMenu();
    const select = screen.getByTestId("main-menu-language");
    expect(select).toBeInTheDocument();
    expect(select.tagName).toBe("SELECT");
    const options = Array.from(
      select.querySelectorAll("option"),
    ) as HTMLOptionElement[];
    expect(options.map((o) => o.value)).toContain("en");
    expect(options.map((o) => o.value)).toContain("ru");
    // top of the menu: the language row is the first child
    const menu = screen.getByTestId("main-menu");
    expect(menu.firstElementChild).toBe(
      screen.getByTestId("main-menu-language-row"),
    );
    expect(screen.getByTestId("main-menu-palette")).toBeInTheDocument();
  });

  it("emits onLanguageChange when a language is picked", () => {
    const { onLanguageChange } = renderMenu();
    fireEvent.change(screen.getByTestId("main-menu-language"), {
      target: { value: "ru" },
    });
    expect(onLanguageChange).toHaveBeenCalledWith("ru");
  });

  it("translates menu labels to Russian when ru is selected", () => {
    renderMenu({ language: "ru" });
    expect(screen.getByTestId("main-menu-palette")).toHaveTextContent(
      "Палитра",
    );
    expect(screen.getByTestId("main-menu-export")).toHaveTextContent(
      "Экспорт/Импорт",
    );
    expect(screen.getByTestId("main-menu-algorithm")).toHaveTextContent(
      "Анимация",
    );
    expect(screen.getByTestId("main-menu-game")).toHaveTextContent("Игра");
    expect(screen.getByTestId("main-menu-feedback")).toHaveTextContent(
      "Отзыв",
    );
  });

  it("keeps English labels by default", () => {
    renderMenu({ language: "en" });
    expect(screen.getByTestId("main-menu-palette")).toHaveTextContent(
      "Palette",
    );
  });
});
