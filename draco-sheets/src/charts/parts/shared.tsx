export { Check, Field, Result } from '../../ui/form';
import { type ReactNode } from 'react';
import { type ChartOpts, type ChartSpec, type ChartType } from '../render';
import { type Out } from '../../data/dataGlue';

export const CHART_TYPES: Array<[ChartType, string]> = [
  ['column', 'Column'],
  ['bar', 'Bar'],
  ['line', 'Line'],
  ['area', 'Area'],
  ['pie', 'Pie'],
  ['doughnut', 'Doughnut'],
  ['scatter', 'Scatter'],
  ['bubble', 'Bubble'],
  ['radar', 'Radar'],
  ['stock', 'Stock'],
  ['combo', 'Combo'],
  ['waterfall', 'Waterfall'],
  ['funnel', 'Funnel'],
  ['histogram', 'Histogram'],
  ['box', 'Box & whisker'],
  ['treemap', 'Treemap'],
  ['sunburst', 'Sunburst'],
  ['surface', 'Surface (top view)'],
  ['surface3d', '3-D surface'],
  ['map', 'Map (US / India / World)'],
];

export const SAMPLE_C = ['A', 'B', 'C', 'D', 'E'];

export const S1 = [4, 7, 5, 9, 6],
  S2 = [3, 5, 6, 4, 8];

export const SAMPLE: Record<ChartType, ChartSpec> = Object.fromEntries(
  CHART_TYPES.map(([t]) => [
    t,
    {
      type: t,
      categories: SAMPLE_C,
      series: [
        { name: 'a', values: S1 },
        { name: 'b', values: S2 },
      ],
      opts: { legend: 'none', labels: false },
    } as ChartSpec,
  ]),
) as never;

export const STYLES: Array<[string, ChartOpts]> = [
  ['Style 1', { palette: 'office', grid: true, theme: 'light' }],
  ['Style 2', { palette: 'vivid', grid: true, labels: true }],
  ['Style 3', { palette: 'pastel', grid: false }],
  ['Style 4', { palette: 'ocean', grid: true, smooth: true }],
  ['Style 5', { palette: 'sunset', grid: false, labels: true }],
  ['Style 6', { palette: 'draco', theme: 'dark', grid: true }],
  ['Mono', { palette: 'mono', grid: true }],
];

export const TKEY = 'draco:chart-templates';

export const loadTpl = (): Record<string, ChartOpts & { __type?: ChartType }> => {
  try {
    return JSON.parse(localStorage.getItem(TKEY) ?? '{}');
  } catch {
    return {};
  }
};

export const saveTpl = (t: Record<string, unknown>) => {
  try {
    localStorage.setItem(TKEY, JSON.stringify(t));
  } catch {
    /* storage unavailable */
  }
};

export const num = (v: string): number | undefined => (v.trim() === '' || !Number.isFinite(+v) ? undefined : +v);

export interface Form {
  type: ChartType;
  range: string;
  title: string;
  byRows: boolean;
  opts: ChartOpts;
  w?: number;
  h?: number;
}

SAMPLE.pie.series = [SAMPLE.pie.series[0]];

SAMPLE.doughnut.series = [SAMPLE.doughnut.series[0]];

SAMPLE.funnel.series = [{ name: 'a', values: [9, 7, 5, 3, 1] }];

SAMPLE.treemap.series = [SAMPLE.treemap.series[0]];

SAMPLE.sunburst = {
  ...SAMPLE.sunburst,
  categories: ['X/1', 'X/2', 'Y/1', 'Y/2', 'Z'],
  series: [SAMPLE.sunburst.series[0]],
};

SAMPLE.scatter = {
  type: 'scatter',
  categories: [],
  series: [{ name: 'a', values: [2, 4, 3, 7, 6], xs: [1, 2, 3, 4, 5] }],
  opts: { legend: 'none' },
};

SAMPLE.bubble = {
  type: 'bubble',
  categories: [],
  series: [{ name: 'a', values: [2, 4, 3, 7, 6], xs: [1, 2, 3, 4, 5], sizes: [3, 9, 5, 12, 2] }],
  opts: { legend: 'none' },
};

SAMPLE.waterfall = {
  type: 'waterfall',
  categories: ['S', 'U', 'D', 'U', 'Total'],
  series: [{ name: 'a', values: [5, 4, -3, 2, 0] }],
  opts: { legend: 'none' },
};

SAMPLE.stock = {
  type: 'stock',
  categories: ['1', '2', '3', '4'],
  series: [
    { name: 'o', values: [10, 12, 11, 13] },
    { name: 'h', values: [14, 15, 13, 16] },
    { name: 'l', values: [9, 11, 9, 12] },
    { name: 'c', values: [12, 11, 12, 15] },
  ],
  opts: { legend: 'none' },
};

SAMPLE.combo = {
  ...SAMPLE.combo,
  series: [
    { name: 'a', values: S1, kind: 'column' },
    { name: 'b', values: S2, kind: 'line', secondary: true },
  ],
};

SAMPLE.histogram = {
  type: 'histogram',
  categories: [],
  series: [{ name: 'a', values: [1, 2, 2, 3, 3, 3, 4, 4, 5, 8] }],
  opts: { legend: 'none', bins: 4 },
};

SAMPLE.surface = {
  type: 'surface',
  categories: ['1', '2', '3', '4'],
  series: [
    { name: 'a', values: [1, 3, 5, 7] },
    { name: 'b', values: [2, 4, 6, 8] },
    { name: 'c', values: [5, 6, 3, 1] },
  ],
  opts: {},
};

SAMPLE.surface3d = {
  type: 'surface3d',
  categories: ['1', '2', '3', '4', '5'],
  series: [
    { name: 'a', values: [1, 3, 5, 7, 4] },
    { name: 'b', values: [2, 4, 6, 8, 5] },
    { name: 'c', values: [5, 6, 3, 1, 2] },
    { name: 'd', values: [3, 2, 4, 6, 8] },
  ],
  opts: {},
};

SAMPLE.map = {
  type: 'map',
  categories: ['CA', 'TX', 'NY', 'FL', 'WA'],
  series: [{ name: 'a', values: [9, 7, 8, 5, 3] }],
  opts: { map: 'us' },
};

SAMPLE.box = {
  type: 'box',
  categories: [],
  series: [
    { name: 'a', values: [1, 3, 4, 5, 6, 7, 20] },
    { name: 'b', values: [2, 3, 5, 6, 8, 9] },
  ],
  opts: { legend: 'none' },
};
