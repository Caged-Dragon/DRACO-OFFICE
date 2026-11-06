import { rulerTicks } from "../../core/geometry/ruler";
import type { View } from "../../core/geometry/viewport";

export const RULER_THICKNESS = 20;

interface Props {
  orientation: "horizontal" | "vertical";
  view: View;
  /** Length of the ruler (the canvas viewport's width or height) in screen pixels. */
  length: number;
  /** Width or height of the slide, in slide pixels. */
  slideLength: number;
  /** Start and end of the selected object along this axis, in slide pixels. */
  selection: [number, number] | null;
}

/** Ruler in slide pixels. Decorative: exact values are available in the Position fields. */
export function Ruler({ orientation, view, length, slideLength, selection }: Props) {
  const horizontal = orientation === "horizontal";
  const pan = horizontal ? view.panX : view.panY;
  const zoom = view.zoom;
  const ticks = rulerTicks({ pan, zoom, length });
  const band = (from: number, to: number, className: string) => {
    const start = pan + from * zoom;
    const size = Math.max(0, (to - from) * zoom);
    return horizontal ? (
      <rect className={className} x={start} y={0} width={size} height={RULER_THICKNESS} />
    ) : (
      <rect className={className} x={0} y={start} width={RULER_THICKNESS} height={size} />
    );
  };

  return (
    <svg
      className={`ruler ruler--${orientation}`}
      data-testid={`ruler-${orientation}`}
      width={horizontal ? length : RULER_THICKNESS}
      height={horizontal ? RULER_THICKNESS : length}
      aria-hidden="true"
      focusable="false"
    >
      {band(0, slideLength, "ruler__slide")}
      {selection && band(selection[0], selection[1], "ruler__selection")}
      {ticks.map((t) => {
        const from = t.major ? 4 : 12;
        return (
          <g key={t.value}>
            {horizontal ? (
              <line className={`ruler__tick${t.major ? " ruler__tick--major" : ""}`} x1={t.position} x2={t.position} y1={from} y2={RULER_THICKNESS} />
            ) : (
              <line className={`ruler__tick${t.major ? " ruler__tick--major" : ""}`} y1={t.position} y2={t.position} x1={from} x2={RULER_THICKNESS} />
            )}
            {t.label !== null && (
              <text className="ruler__label" x={horizontal ? t.position + 2 : 2} y={horizontal ? 10 : t.position + 10}>
                {t.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
