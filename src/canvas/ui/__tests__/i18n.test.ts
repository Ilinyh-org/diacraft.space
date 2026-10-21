import { describe, it, expect, beforeEach } from "vitest";
import {
  LANGUAGES,
  loadLanguage,
  saveLanguage,
  t,
} from "../i18n";

describe("i18n (issue #62)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("lists English and Russian", () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(["en", "ru"]);
  });

  it("translates every menu label in both languages", () => {
    const keys = [
      "menu.palette",
      "menu.export",
      "menu.algorithm",
      "menu.game",
      "menu.feedback",
    ] as const;
    for (const key of keys) {
      expect(t("en", key).length).toBeGreaterThan(0);
      expect(t("ru", key).length).toBeGreaterThan(0);
      expect(t("en", key)).not.toBe(t("ru", key));
    }
  });

  it("falls back to English for unknown language or key", () => {
    expect(t("xx" as never, "menu.palette")).toBe(t("en", "menu.palette"));
  });

  it("persists and loads the chosen language", () => {
    expect(loadLanguage()).toBe("en");
    saveLanguage("ru");
    expect(loadLanguage()).toBe("ru");
  });

  it("ignores garbage in localStorage", () => {
    localStorage.setItem("block-diagram-language-v1", "zz");
    expect(loadLanguage()).toBe("en");
  });
});
