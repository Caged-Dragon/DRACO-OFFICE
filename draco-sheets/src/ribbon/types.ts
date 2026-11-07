/** Shared ribbon types. Hierarchy: tab → group → item. */
export interface Item { l: string; i: string; c?: string; run?: () => void; size?: 's' }
export interface Group { n: string; items: Item[] }
/** Callbacks the host app gives the ribbon for actions that are not registered commands. */
export interface RibbonCtx { newWb: () => void; save: () => void; home: () => void; settings: () => void; palette: () => void }
export const TABS = ['File', 'Home', 'Insert', 'Draw', 'Page Layout', 'Formulas', 'Data', 'Review', 'View', 'Automate', 'Help'] as const;
export type RibbonTab = (typeof TABS)[number];
