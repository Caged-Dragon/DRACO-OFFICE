/** Shared ribbon types. Hierarchy: tab → group → item (→ menu entries for drop-downs). */
export interface MenuEntry {
  l: string;
  i?: string;
  c?: string;
  run?: () => void;
  color?: string;
  font?: string;
}
export interface Item {
  l: string;
  i?: string;
  c?: string;
  run?: () => void;
  size?: 's';
  color?: string;
  font?: string;
  /** Drop-down entries. With an action (c/run) the button is a split button; without one the main click repeats the last entry. */
  menu?: MenuEntry[];
  /** Show menu entries as a swatch grid (colour pickers). */ grid?: boolean;
  /** Default entry for a no-action menu button. */ def?: number;
  /** Text drop-down (e.g. Font, Size, Number format): shows this text and a caret, and only opens the menu. */ text?: string;
}
export interface Group {
  n: string;
  items: Item[];
  /** Lay icons out in this many rows (compact grid). */ rows?: number;
  /** Excel-style stacked lines of controls; when set, `items` is just their flattened list. */ lines?: Item[][];
  /** Large buttons with a caption under the icon (used on the less dense tabs). */ big?: boolean;
}
/** Callbacks the host app gives the ribbon for actions that are not registered commands. */
export interface RibbonCtx {
  newWb: () => void;
  save: () => void;
  home: () => void;
  settings: () => void;
  palette: () => void;
  fileMenu: () => void;
}
export const TABS = [
  'File',
  'Home',
  'Insert',
  'Draw',
  'Page Layout',
  'Formulas',
  'Data',
  'Review',
  'View',
  'Automate',
  'Help',
] as const;
export type RibbonTab = (typeof TABS)[number];
/** Build a group from stacked lines of controls. */
export const stacked = (n: string, lines: Item[][]): Group => ({ n, items: lines.flat(), lines });
/** Build a group of large captioned buttons. */
export const bigGroup = (n: string, items: Item[]): Group => ({ n, items, big: true });
