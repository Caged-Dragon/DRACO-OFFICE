// Insert-tab commands: one-click charts from the selection and basic shapes.
import type { Engine } from '../core/engine';
import { createChart } from '../charts/chartGlue';
import type { ChartType } from '../charts/render';
import { addShape } from '../objects/objectGlue';
import type { ShapeKind } from '../objects/shapes';
import { toastOut } from '../ui/toast';

type AddFn = (
  id: string,
  title: string,
  group: string,
  run: () => unknown | Promise<unknown>,
  keywords?: string,
) => void;

export const CHART_KINDS: [ChartType, string][] = [
  ['column', 'Column chart'],
  ['bar', 'Bar chart'],
  ['line', 'Line chart'],
  ['area', 'Area chart'],
  ['pie', 'Pie chart'],
  ['doughnut', 'Doughnut chart'],
  ['scatter', 'Scatter chart'],
  ['radar', 'Radar chart'],
  ['combo', 'Combo chart'],
  ['waterfall', 'Waterfall chart'],
  ['funnel', 'Funnel chart'],
  ['histogram', 'Histogram'],
];
export const SHAPE_KINDS: [ShapeKind, string][] = [
  ['rect', 'Rectangle'],
  ['round', 'Rounded rectangle'],
  ['ellipse', 'Oval'],
  ['triangle', 'Triangle'],
  ['star', 'Star'],
  ['arrowRight', 'Arrow right'],
  ['line', 'Line'],
  ['text', 'Text box'],
];

export function registerInsert(add: AddFn, eng: () => Engine | null): void {
  for (const [type, title] of CHART_KINDS)
    add(
      `insert.chart.${type}`,
      `Insert ${title.toLowerCase()}`,
      'Insert',
      () => {
        const e = eng();
        if (e) toastOut(createChart(e, { type }));
      },
      'chart graph',
    );
  for (const [kind, title] of SHAPE_KINDS)
    add(
      `insert.shape.${kind}`,
      `Insert ${title.toLowerCase()}`,
      'Insert',
      () => {
        const e = eng();
        if (e) toastOut(addShape(e, { kind, ...(kind === 'text' ? { text: 'Text' } : {}) }));
      },
      'shape',
    );
}
