// Internationalisation for all user-facing text (issue #62).
//
// Adding a new language is a two-step, type-checked process:
//   1. add one entry to LANGUAGES below (code + native label);
//   2. add one record to TRANSLATIONS with every TranslationKey.
// TypeScript fails the build if any key is missing, and the i18n tests
// verify every declared language covers every key.

export type TranslationKey =
  // main menu
  | "menu.language"
  | "menu.palette"
  | "menu.export"
  | "menu.algorithm"
  | "menu.game"
  | "menu.feedback"
  // palette panel
  | "palette.draw"
  | "palette.select"
  | "palette.undo"
  | "palette.redo"
  | "palette.clear"
  | "palette.confirmClear"
  // block type labels (palette items + default labels)
  | "block.startEnd"
  | "block.action"
  | "block.condition"
  | "block.io"
  | "block.forloop"
  | "block.function"
  | "block.link"
  | "block.text"
  | "block.start"
  // export/import panel
  | "export.title"
  | "export.import"
  | "export.importFailed"
  | "export.unknownError"
  // animation panel
  | "algorithm.title"
  | "algorithm.run"
  | "algorithm.stop"
  | "algorithm.speed"
  // feedback panel
  | "feedback.title"
  | "feedback.name"
  | "feedback.email"
  | "feedback.message"
  | "feedback.submit"
  | "feedback.sending"
  | "feedback.success"
  | "feedback.error"
  // context menu
  | "context.cut"
  | "context.copy"
  | "context.paste"
  | "context.delete"
  | "context.rename"
  // game panel
  | "game.title"
  | "game.levels"
  | "game.run"
  | "game.stop"
  | "game.nextLevel"
  | "game.win"
  | "game.crash"
  | "game.timeout"
  | "game.tooShort"
  | "game.ioTitle"
  | "game.task"
  | "game.taskFallback"
  | "game.selectLevel"
  | "game.prevLevel"
  | "game.needInput"
  | "game.doorLocked"
  | "game.wrongPassword"
  // flowchart validation
  | "flow.noStart"
  | "flow.mustReachEnd"
  | "flow.multipleOutgoing"
  | "flow.arrowMissing"
  | "flow.noLoops"
  | "flow.unknownAction"
  | "flow.wrongInputName"
  | "flow.notPartOfFlowchart";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "es", label: "Español" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const TRANSLATIONS: Record<LanguageCode, Record<TranslationKey, string>> = {
  en: {
    "menu.language": "Language",
    "menu.palette": "Palette",
    "menu.export": "Export/Import",
    "menu.algorithm": "Animation",
    "menu.game": "Game",
    "menu.feedback": "Feedback",
    "palette.draw": "Draw ✏️",
    "palette.select": "Select ✋",
    "palette.undo": "↶",
    "palette.redo": "↷",
    "palette.clear": "Clear",
    "palette.confirmClear": "Clear the whole diagram?",
    "block.startEnd": "Start/End",
    "block.action": "Action",
    "block.condition": "Condition",
    "block.io": "I/O",
    "block.forloop": "For-loop",
    "block.function": "Function",
    "block.link": "Link",
    "block.text": "Text",
    "block.start": "Start",
    "export.title": "Export",
    "export.import": "Import",
    "export.importFailed": "Import failed: {message}",
    "export.unknownError": "unknown error",
    "algorithm.title": "Animation",
    "algorithm.run": "Run",
    "algorithm.stop": "Stop",
    "algorithm.speed": "Speed: {speed}",
    "feedback.title": "Feedback",
    "feedback.name": "Name",
    "feedback.email": "Email",
    "feedback.message": "Message",
    "feedback.submit": "Submit",
    "feedback.sending": "Sending…",
    "feedback.success": "Success! Your message has been sent.",
    "feedback.error": "Error: something went wrong. Please try again.",
    "context.cut": "Cut",
    "context.copy": "Copy",
    "context.paste": "Paste",
    "context.delete": "Delete",
    "context.rename": "Rename",
    "game.title": "Algorithm Game",
    "game.levels": "Levels",
    "game.run": "▶ Run",
    "game.stop": "■ Stop",
    "game.nextLevel": "Next level →",
    "game.task": "Task",
    "game.taskFallback": "Lead the robot to the flag ⚑.",
    "game.selectLevel": "Select a level:",
    "game.prevLevel": "← Prev",
    "game.win": "✔ Level complete!",
    "game.crash": "✖ The robot crashed into a wall.",
    "game.timeout": "✖ Program ran too long.",
    "game.tooShort": "✖ The robot stopped short of the flag.",
    "game.ioTitle": "Program I/O",
    "game.needInput": "✖ Waiting for input — add a direction above and run again.",
    "game.doorLocked": "✖ The door is locked — the Input block asks for the password.",
    "game.wrongPassword": "✖ Wrong password — the door stays locked.",
    "flow.noStart": "Add a Start block to the canvas.",
    "flow.mustReachEnd": "The flowchart must reach an End block.",
    "flow.multipleOutgoing": 'Block "{label}" has more than one outgoing arrow.',
    "flow.arrowMissing": "An arrow points to a missing block.",
    "flow.noLoops": "The flowchart must not contain loops.",
    "flow.unknownAction":
      'Unknown action "{label}". Rename the block to Move, Turn left or Turn right.',
    "flow.wrongInputName":
      'The task expects an input block named exactly "{name}" — rename your input block to "{name}". The run still proceeds through the block.',
    "flow.notPartOfFlowchart": 'Block "{label}" is not part of the flowchart.',
  },
  ru: {
    "menu.language": "Язык",
    "menu.palette": "Палитра",
    "menu.export": "Экспорт/Импорт",
    "menu.algorithm": "Анимация",
    "menu.game": "Игра",
    "menu.feedback": "Отзыв",
    "palette.draw": "Рисовать ✏️",
    "palette.select": "Выделить ✋",
    "palette.undo": "↶",
    "palette.redo": "↷",
    "palette.clear": "Очистить",
    "palette.confirmClear": "Очистить всю диаграмму?",
    "block.startEnd": "Начало/Конец",
    "block.action": "Действие",
    "block.condition": "Условие",
    "block.io": "Ввод/Вывод",
    "block.forloop": "Цикл For",
    "block.function": "Функция",
    "block.link": "Ссылка",
    "block.text": "Текст",
    "block.start": "Начало",
    "export.title": "Экспорт",
    "export.import": "Импорт",
    "export.importFailed": "Ошибка импорта: {message}",
    "export.unknownError": "неизвестная ошибка",
    "algorithm.title": "Анимация",
    "algorithm.run": "Запуск",
    "algorithm.stop": "Стоп",
    "algorithm.speed": "Скорость: {speed}",
    "feedback.title": "Отзыв",
    "feedback.name": "Имя",
    "feedback.email": "Email",
    "feedback.message": "Сообщение",
    "feedback.submit": "Отправить",
    "feedback.sending": "Отправка…",
    "feedback.success": "Готово! Ваше сообщение отправлено.",
    "feedback.error": "Ошибка: что-то пошло не так. Попробуйте ещё раз.",
    "context.cut": "Вырезать",
    "context.copy": "Копировать",
    "context.paste": "Вставить",
    "context.delete": "Удалить",
    "context.rename": "Переименовать",
    "game.title": "Игра «Алгоритм»",
    "game.levels": "Уровни",
    "game.run": "▶ Запуск",
    "game.stop": "■ Стоп",
    "game.nextLevel": "Следующий уровень →",
    "game.task": "Задача",
    "game.taskFallback": "Проведите робота к флагу ⚑.",
    "game.selectLevel": "Выберите уровень:",
    "game.prevLevel": "← Назад",
    "game.win": "✔ Уровень пройден!",
    "game.crash": "✖ Робот врезался в стену.",
    "game.timeout": "✖ Программа работала слишком долго.",
    "game.tooShort": "✖ Робот остановился, не дойдя до флага.",
    "game.ioTitle": "Ввод/вывод программы",
    "game.needInput": "✖ Ожидаю ввод — добавьте направление выше и запустите снова.",
    "game.doorLocked": "✖ Дверь заперта — блок «Ввод» запрашивает пароль.",
    "game.wrongPassword": "✖ Неверный пароль — дверь остаётся запертой.",
    "flow.noStart": "Добавьте блок «Начало» на холст.",
    "flow.mustReachEnd": "Блок-схема должна заканчиваться блоком «Конец».",
    "flow.multipleOutgoing": 'У блока «{label}» более одной исходящей стрелки.',
    "flow.arrowMissing": "Стрелка указывает на несуществующий блок.",
    "flow.noLoops": "Блок-схема не должна содержать циклов.",
    "flow.unknownAction":
      'Неизвестное действие «{label}». Переименуйте блок в Идти, Налево или Направо.',
    "flow.wrongInputName":
      'Задача ждёт блок ввода с точным названием «{name}» — переименуйте ваш блок ввода в «{name}». Запуск всё равно продолжится через блок.',
    "flow.notPartOfFlowchart": 'Блок «{label}» не является частью блок-схемы.',
  },
  es: {
    "menu.language": "Idioma",
    "menu.palette": "Paleta",
    "menu.export": "Exportar/Importar",
    "menu.algorithm": "Animación",
    "menu.game": "Juego",
    "menu.feedback": "Comentarios",
    "palette.draw": "Dibujar ✏️",
    "palette.select": "Seleccionar ✋",
    "palette.undo": "↶",
    "palette.redo": "↷",
    "palette.clear": "Limpiar",
    "palette.confirmClear": "¿Limpiar todo el diagrama?",
    "block.startEnd": "Inicio/Fin",
    "block.action": "Acción",
    "block.condition": "Condición",
    "block.io": "E/S",
    "block.forloop": "Bucle For",
    "block.function": "Función",
    "block.link": "Enlace",
    "block.text": "Texto",
    "block.start": "Inicio",
    "export.title": "Exportar",
    "export.import": "Importar",
    "export.importFailed": "Error al importar: {message}",
    "export.unknownError": "error desconocido",
    "algorithm.title": "Animación",
    "algorithm.run": "Ejecutar",
    "algorithm.stop": "Detener",
    "algorithm.speed": "Velocidad: {speed}",
    "feedback.title": "Comentarios",
    "feedback.name": "Nombre",
    "feedback.email": "Correo electrónico",
    "feedback.message": "Mensaje",
    "feedback.submit": "Enviar",
    "feedback.sending": "Enviando…",
    "feedback.success": "¡Listo! Tu mensaje ha sido enviado.",
    "feedback.error": "Error: algo salió mal. Inténtalo de nuevo.",
    "context.cut": "Cortar",
    "context.copy": "Copiar",
    "context.paste": "Pegar",
    "context.delete": "Eliminar",
    "context.rename": "Renombrar",
    "game.title": "Juego de Algoritmos",
    "game.levels": "Niveles",
    "game.run": "▶ Ejecutar",
    "game.stop": "■ Detener",
    "game.nextLevel": "Siguiente nivel →",
    "game.task": "Tarea",
    "game.taskFallback": "Guía al robot hasta la bandera ⚑.",
    "game.selectLevel": "Elige un nivel:",
    "game.prevLevel": "← Anterior",
    "game.win": "✔ ¡Nivel completado!",
    "game.crash": "✖ El robot chocó contra una pared.",
    "game.timeout": "✖ El programa tardó demasiado.",
    "game.tooShort": "✖ El robot se detuvo antes de llegar a la bandera.",
    "game.ioTitle": "E/S del programa",
    "game.needInput": "✖ Esperando entrada — añade una dirección arriba y ejecuta de nuevo.",
    "game.doorLocked": "✖ La puerta está cerrada — el bloque de Entrada pide la contraseña.",
    "game.wrongPassword": "✖ Contraseña incorrecta — la puerta sigue cerrada.",
    "flow.noStart": "Añade un bloque de Inicio al lienzo.",
    "flow.mustReachEnd": "El diagrama de flujo debe llegar a un bloque de Fin.",
    "flow.multipleOutgoing": 'El bloque "{label}" tiene más de una flecha saliente.',
    "flow.arrowMissing": "Una flecha apunta a un bloque inexistente.",
    "flow.noLoops": "El diagrama de flujo no debe contener bucles.",
    "flow.unknownAction":
      'Acción desconocida "{label}". Renombra el bloque a Mover, Girar a la izquierda o Girar a la derecha.',
    "flow.wrongInputName":
      'La tarea espera un bloque de entrada llamado exactamente "{name}" — renombra tu bloque de entrada a "{name}". La ejecución continúa a través del bloque.',
    "flow.notPartOfFlowchart": 'El bloque "{label}" no es parte del diagrama de flujo.',
  },
};

export function t(
  lang: LanguageCode,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const template =
    (TRANSLATIONS[lang as LanguageCode] ?? TRANSLATIONS.en)[key] ??
    TRANSLATIONS.en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name) =>
    name in params ? String(params[name]) : m,
  );
}

/** Translation for a dynamic key; null when the key has no translation. */
export function tOptional(
  lang: LanguageCode,
  key: string,
): string | null {
  const dict = (TRANSLATIONS[lang as LanguageCode] ?? TRANSLATIONS.en) as
    Record<string, string>;
  return dict[key] ?? null;
}

/** All translation keys for the given language; used by the completeness test. */
export function translationKeys(lang: LanguageCode): string[] {
  return Object.keys(TRANSLATIONS[lang] ?? TRANSLATIONS.en);
}

const KEY = "block-diagram-language-v1";

export function loadLanguage(): LanguageCode {
  try {
    const raw = localStorage.getItem(KEY);
    if (LANGUAGES.some((l) => l.code === raw)) return raw as LanguageCode;
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
