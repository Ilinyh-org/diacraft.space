import type { MenuId } from "./MainMenu";

export type MenuVisibility = Record<MenuId, boolean>;

/** Initially only the palette is visible, per issue #31. */
export const INITIAL_MENU_VISIBILITY: MenuVisibility = {
  palette: true,
  export: false,
  algorithm: false,
  game: false,
  feedback: false,
};
