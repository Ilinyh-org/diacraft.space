import { describe, it, expect, beforeEach } from "vitest";
import {
  LANGUAGES,
  loadLanguage,
  saveLanguage,
  t,
  translationKeys,
} from "../i18n";

describe("i18n (issue #62)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("lists English, Russian and Spanish", () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(["en", "ru", "es"]);
  });

  it("covers every key in every declared language (issue #62 completeness)", () => {
    const enKeys = translationKeys("en").sort();
    for (const { code } of LANGUAGES) {
      expect(translationKeys(code).sort()).toEqual(enKeys);
    }
  });

  it("translates panel text, not just the main menu (#62: all text)", () => {
    for (const key of [
      "palette.draw",
      "palette.clear",
      "export.title",
      "export.import",
      "algorithm.run",
      "feedback.submit",
      "context.cut",
      "game.title",
      "game.ioTitle",
      "flow.mustReachEnd",
    ] as const) {
      expect(t("ru", key)).not.toBe(t("en", key));
      expect(t("ru", key).length).toBeGreaterThan(0);
      expect(t("es", key)).not.toBe(t("en", key));
      expect(t("es", key).length).toBeGreaterThan(0);
    }
  });

  it("undo/redo buttons are icon-only, no text (#79)", () => {
    for (const key of ["palette.undo", "palette.redo"] as const) {
      for (const lang of ["en", "ru", "es"] as const) {
        expect(["↶", "↷"]).toContain(t(lang, key));
      }
    }
  });

  it("interpolates parameters", () => {
    expect(t("en", "algorithm.speed", { speed: 5 })).toContain("5");
    expect(t("ru", "flow.notPartOfFlowchart", { label: "X" })).toContain("X");
    expect(t("es", "flow.notPartOfFlowchart", { label: "X" })).toContain("X");
  });

  it("translates every menu label in all languages (issue #111)", () => {
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
      expect(t("es", key).length).toBeGreaterThan(0);
      expect(t("en", key)).not.toBe(t("es", key));
    }
  });

  it("falls back to English for unknown language or key", () => {
    expect(t("xx" as never, "menu.palette")).toBe(t("en", "menu.palette"));
  });

  it("persists and loads the chosen language", () => {
    expect(loadLanguage()).toBe("en");
    saveLanguage("ru");
    expect(loadLanguage()).toBe("ru");
    saveLanguage("es");
    expect(loadLanguage()).toBe("es");
  });

  it("ignores garbage in localStorage", () => {
    localStorage.setItem("block-diagram-language-v1", "zz");
    expect(loadLanguage()).toBe("en");
  });
});
