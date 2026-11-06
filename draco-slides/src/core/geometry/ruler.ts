export interface RulerTick {
  /** Position on the slide, in slide pixels. */
  value: number;
  /** Position along the ruler, in screen pixels. */
  position: number;
  major: boolean;
  label: string | null;
}

const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

/** Smallest "nice" step (1, 2, 5 times a power of ten) whose labels are at least `minSpacing` screen pixels apart. */
export function rulerStep(zoom: number, minSpacing = 50): number {
  return STEPS.find((s) => s * zoom >= minSpacing) ?? STEPS[STEPS.length - 1];
}

/**
 * Tick marks for one ruler. `pan` is where slide position 0 appears along the ruler and `length` the ruler's length,
 * both in screen pixels. Major ticks carry a label; minor ticks subdivide the step where that gives whole numbers.
 */
export function rulerTicks({ pan, zoom, length, minSpacing = 50 }: { pan: number; zoom: number; length: number; minSpacing?: number }): RulerTick[] {
  const step = rulerStep(zoom, minSpacing);
  const lead = String(step)[0];
  const sub = step >= 10 ? (lead === "2" ? 2 : 5) : 1;
  const minor = step / sub;
  const lo = (0 - pan) / zoom;
  const hi = (length - pan) / zoom;
  const ticks: RulerTick[] = [];
  for (let value = Math.floor(lo / minor) * minor; value <= hi + minor; value += minor) {
    const v = Math.round(value * 1e6) / 1e6;
    const position = pan + v * zoom;
    if (position < -1 || position > length + 1) continue;
    const ratio = v / step;
    const major = Math.abs(ratio - Math.round(ratio)) < 1e-9;
    ticks.push({ value: v, position, major, label: major ? String(Math.round(v)) : null });
    if (ticks.length > 1000) break;
  }
  return ticks;
}
