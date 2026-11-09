// UI themes + colour palettes (v100). Pure data.
export interface Theme {
  id: string;
  label: string;
  dark: boolean;
  vars: Record<string, string>;
}
export const THEMES: Theme[] = [
  { id: 'system', label: 'Match my device (gold / purple)', dark: false, vars: {} },
  {
    id: 'light',
    label: 'Gold (light)',
    dark: false,
    vars: {
      '--bg': '#fffdf6',
      '--fg': '#2a2310',
      '--muted': '#6f6444',
      '--line': '#eadfbd',
      '--bar': '#faf3dc',
      '--brand': '#8a6508',
      '--brand-2': '#b8860b',
    },
  },
  {
    id: 'dark',
    label: 'Purple (dark)',
    dark: true,
    vars: {
      '--bg': '#13101f',
      '--fg': '#ece8f8',
      '--muted': '#a79fc4',
      '--line': '#2e2748',
      '--bar': '#1c1730',
      '--brand': '#7c4dff',
      '--brand-2': '#a78bfa',
    },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    dark: false,
    vars: {
      '--bg': '#ffffff',
      '--fg': '#10222f',
      '--muted': '#51667a',
      '--line': '#d6e2ee',
      '--bar': '#eef5fb',
      '--brand': '#0b5cad',
      '--brand-2': '#1976d2',
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    dark: false,
    vars: {
      '--bg': '#fffdfb',
      '--fg': '#2b1a14',
      '--muted': '#7a5a4d',
      '--line': '#f0ddd2',
      '--bar': '#fff3ea',
      '--brand': '#b23a0e',
      '--brand-2': '#d9531e',
    },
  },
  {
    id: 'graphite',
    label: 'Graphite (dark)',
    dark: true,
    vars: {
      '--bg': '#1a1b1e',
      '--fg': '#e6e6e9',
      '--muted': '#9a9aa3',
      '--line': '#32333a',
      '--bar': '#222328',
      '--brand': '#7c8cff',
      '--brand-2': '#98a4ff',
    },
  },
  {
    id: 'paper',
    label: 'Paper',
    dark: false,
    vars: {
      '--bg': '#fbf8f1',
      '--fg': '#2a2620',
      '--muted': '#756c5d',
      '--line': '#e4dccb',
      '--bar': '#f3eddf',
      '--brand': '#6b4f1d',
      '--brand-2': '#8a6a2b',
    },
  },
];
export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export interface Palette {
  id: string;
  label: string;
  colors: string[];
}
export const PALETTES: Palette[] = [
  {
    id: 'draco',
    label: 'Draco green',
    colors: [
      '#0f5132',
      '#14783f',
      '#7bc99a',
      '#d7efdf',
      '#f5b942',
      '#e07a1f',
      '#2563eb',
      '#7c3aed',
      '#6b7280',
      '#111827',
    ],
  },
  {
    id: 'office',
    label: 'Classic office',
    colors: [
      '#4472c4',
      '#ed7d31',
      '#a5a5a5',
      '#ffc000',
      '#5b9bd5',
      '#70ad47',
      '#264478',
      '#9e480e',
      '#636363',
      '#997300',
    ],
  },
  {
    id: 'pastel',
    label: 'Soft pastel',
    colors: [
      '#fbd5d5',
      '#fde7c4',
      '#fdf6b2',
      '#d1f2d9',
      '#cfe8fc',
      '#e1d7fb',
      '#fbd5ec',
      '#e5e7eb',
      '#c7f0ec',
      '#f3e3d3',
    ],
  },
  {
    id: 'bold',
    label: 'Bold',
    colors: [
      '#dc2626',
      '#ea580c',
      '#ca8a04',
      '#16a34a',
      '#0891b2',
      '#2563eb',
      '#7c3aed',
      '#c026d3',
      '#475569',
      '#000000',
    ],
  },
  {
    id: 'cb',
    label: 'Colour-blind safe',
    colors: [
      '#0072b2',
      '#e69f00',
      '#009e73',
      '#cc79a7',
      '#56b4e9',
      '#d55e00',
      '#f0e442',
      '#000000',
      '#999999',
      '#ffffff',
    ],
  },
];
export const textOn = (hex: string): string => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#111827' : '#ffffff';
};
