import type { MenuEntry } from '../../types';
export const COLOURS: [string, string, string][] = [
  ['red', 'Red', '#e03131'],
  ['orange', 'Orange', '#f08c00'],
  ['yellow', 'Yellow', '#fcc419'],
  ['green', 'Green', '#2f9e44'],
  ['blue', 'Blue', '#1971c2'],
  ['purple', 'Purple', '#7048e8'],
  ['gray', 'Gray', '#868e96'],
  ['black', 'Black', '#000000'],
  ['white', 'White', '#ffffff'],
];
/** Swatch entries for a colour drop-down: `fmt.color.red`, `fmt.fill.red`… */
export const swatches = (kind: 'color' | 'fill' | 'sheet.tab', labelPrefix: string): MenuEntry[] =>
  COLOURS.map(([k, n, hex]) => ({
    l: `${labelPrefix} ${n.toLowerCase()}`,
    i: '■',
    color: hex,
    c: kind === 'sheet.tab' ? `sheet.tab.${k}` : `fmt.${kind}.${k}`,
  }));
