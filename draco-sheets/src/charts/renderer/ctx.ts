import type { ChartSpec, ChartOpts, Series, ChartType } from './types';

/** Everything a per-type renderer needs from the shared chart frame (size, margins, palette, svg buffer). */
export interface RenderCtx {
  spec: ChartSpec;
  o: ChartOpts;
  dark: boolean;
  pal: string[];
  col: (i: number, s?: Series) => string;
  fg: string;
  mute: string;
  gridc: string;
  bg: string;
  font: string;
  out: string[];
  t: ChartType;
  cats: string[];
  ser: Series[];
  W: number;
  H: number;
  L: number;
  R: number;
  T: number;
  B: number;
  pw: number;
  ph: number;
  empty: () => string;
  legW: number;
  titleH: number;
  legendPos: NonNullable<ChartOpts['legend']>;
  showLegend: boolean;
  secondary: boolean;
  hasAxes: boolean;
  tName: string;
  pieLike: boolean;
  legendItems: Array<{ name: string; color: string }>;
}
