import type { Group, RibbonCtx, RibbonTab } from './types';
import { fileGroups } from './tabs/file';
import { homeGroups } from './tabs/home';
import { insertGroups } from './tabs/insert';
import { drawGroups } from './tabs/draw';
import { pageLayoutGroups } from './tabs/pageLayout';
import { formulasGroups } from './tabs/formulas';
import { dataGroups } from './tabs/data';
import { reviewGroups } from './tabs/review';
import { viewGroups } from './tabs/view';
import { automateGroups } from './tabs/automate';
import { helpGroups } from './tabs/help';

/** The one place that maps a tab to its groups. */
export const groupsFor = (tab: RibbonTab, x: RibbonCtx): Group[] => ({
  File: () => fileGroups(x), Home: () => homeGroups(), Insert: () => insertGroups(x), Draw: () => drawGroups(x), 'Page Layout': () => pageLayoutGroups(x),
  Formulas: () => formulasGroups(x), Data: () => dataGroups(x), Review: () => reviewGroups(x), View: () => viewGroups(x), Automate: () => automateGroups(x), Help: () => helpGroups(x),
}[tab]());

const noop = () => undefined;
/** Every command id the ribbon refers to (used by tests to prove no button points at a missing command). */
export const allCommandIds = (): string[] => [...new Set((['File', 'Home', 'Insert', 'Draw', 'Page Layout', 'Formulas', 'Data', 'Review', 'View', 'Automate', 'Help'] as RibbonTab[]).flatMap((t) => groupsFor(t, { newWb: noop, save: noop, home: noop, settings: noop, palette: noop }).flatMap((g) => g.items.map((i) => i.c ?? ''))).filter(Boolean))];
