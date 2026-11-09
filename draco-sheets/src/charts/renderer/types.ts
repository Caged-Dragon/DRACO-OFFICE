import type { MapKind } from '../maps';
export type ChartType =
  | 'column'
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'doughnut'
  | 'scatter'
  | 'bubble'
  | 'radar'
  | 'stock'
  | 'combo'
  | 'waterfall'
  | 'funnel'
  | 'histogram'
  | 'box'
  | 'treemap'
  | 'sunburst'
  | 'surface'
  | 'surface3d'
  | 'map';
export interface Series {
  name: string;
  values: Array<number | null>;
  xs?: number[];
  sizes?: number[];
  kind?: 'column' | 'line' | 'area';
  secondary?: boolean;
  color?: string;
}
export interface Trend {
  type: 'linear' | 'exp' | 'log' | 'power' | 'poly' | 'ma';
  degree?: number;
  period?: number;
  forward?: number;
  showEq?: boolean;
  showR2?: boolean;
}
export interface ChartOpts {
  legend?: 'top' | 'bottom' | 'left' | 'right' | 'none';
  labels?: boolean;
  grid?: boolean;
  xTitle?: string;
  yTitle?: string;
  y2Title?: string;
  stack?: 'none' | 'stacked' | 'percent';
  trend?: Trend;
  err?: { kind: 'fixed' | 'pct' | 'stdev'; value?: number };
  palette?: string;
  logY?: boolean;
  smooth?: boolean;
  markers?: boolean;
  hole?: number;
  bins?: number;
  binWidth?: number;
  theme?: 'light' | 'dark';
  font?: string;
  yMin?: number;
  yMax?: number;
  bg?: string;
  map?: MapKind;
  azimuth?: number;
  elevation?: number;
}
export interface ChartSpec {
  type: ChartType;
  title?: string;
  categories: string[];
  series: Series[];
  opts?: ChartOpts;
}

export const PALETTES: Record<string, string[]> = {
  office: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9E480E'],
  vivid: ['#E6194B', '#3CB44B', '#4363D8', '#F58231', '#911EB4', '#42D4F4', '#F032E6', '#BFEF45'],
  pastel: ['#8FB8DE', '#F5B7B1', '#B5E2B1', '#F9E79F', '#D2B4DE', '#AED6F1', '#F8C471', '#A3E4D7'],
  ocean: ['#03396C', '#005B96', '#6497B1', '#B3CDE0', '#0E86D4', '#68BBE3', '#055C9D', '#2E8BC0'],
  sunset: ['#D1495B', '#EDAE49', '#00798C', '#30638E', '#003D5B', '#F79256', '#8D5B4C', '#FBC4AB'],
  mono: ['#222222', '#555555', '#888888', '#AAAAAA', '#CCCCCC', '#444444', '#777777', '#999999'],
  draco: ['#E4572E', '#29335C', '#F3A712', '#A8C686', '#669BBC', '#8F2D56', '#2D936C', '#F7B2AD'],
};
export const PALETTE_NAMES = Object.keys(PALETTES);
