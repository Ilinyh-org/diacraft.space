export type LanguageCode = "en" | "ru";

export type TranslationKey =
  | "menu.language"
  | "menu.palette"
  | "menu.export"
  | "menu.algorithm"
  | "menu.game"
  | "menu.feedback";

export const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
];

const TRANSLATIONS: Record<LanguageCode, Record<TranslationKey, string>> = {
  en: {
    "menu.language": "Language",
    "menu.palette": "Palette",
    "menu.export": "Export/Import",
    "menu.algorithm": "Animation",
    "menu.game": "Game",
    "menu.feedback": "Feedback",
  },
  ru: {
    "menu.language": "Язык",
    "menu.palette": "Палитра",
    "menu.export": "Экспорт/Импорт",
    "menu.algorithm": "Анимация",
    "menu.game": "Игра",
    "menu.feedback": "Отзыв",
  },
};

export function t(lang: LanguageCode, key: TranslationKey): string {
  return (TRANSLATIONS[lang] ?? TRANSLATIONS.en)[key];
}

const KEY = "block-diagram-language-v1";

export function loadLanguage(): LanguageCode {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "en" || raw === "ru") return raw;
  } catch {
    // ignore
  }
  return "en";
}

export function saveLanguage(lang: LanguageCode) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // ignore
  }
}
