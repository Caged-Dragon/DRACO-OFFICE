import { splitLines } from "../../core/document-model/lists";
import { cornerRadius } from "../../core/document-model/shapes";
import type { Presentation, Slide, TextObject } from "../../core/document-model/types";
import { textClassNames, textStyle } from "./textStyle";

interface Props {
  presentation: Pick<Presentation, "width" | "height">;
  slide: Slide;
  /** Rendered width in CSS px; the slide scales uniformly from its model size. */
  displayWidth: number;
  /** Clip objects that extend past the slide edge (thumbnails, presenting). The editing canvas shows them. */
  clip?: boolean;
  /** Object whose text is being edited in place: its text is drawn by the editor (its shape stays visible). */
  hideObjectId?: string | null;
}

/** The drawn part of an object: fill and outline of a rectangle, rounded rectangle or ellipse, or the stroke of a line. */
function ShapeLayer({ o }: { o: TextObject }) {
  if (o.shape === "line") {
    return (
      <svg
        className="slide__shape slide__shape--line"
        data-shape="line"
        aria-hidden="true"
        focusable="false"
        width="100%"
        height="100%"
        overflow="visible"
      >
        <line
          x1="0"
          y1={o.flipV ? "100%" : "0"}
          x2="100%"
          y2={o.flipV ? "0" : "100%"}
          stroke={o.stroke ?? "none"}
          strokeWidth={o.strokeWidth}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (!o.fill && !o.stroke) return null; // a plain text box draws nothing
  const outlined = o.stroke !== null && o.strokeWidth > 0;
  return (
    <span
      className="slide__shape"
      data-shape={o.shape}
      aria-hidden="true"
      style={{
        backgroundColor: o.fill ?? "transparent",
        borderStyle: outlined ? "solid" : "none",
        borderWidth: outlined ? o.strokeWidth : 0,
        borderColor: outlined ? (o.stroke ?? undefined) : undefined,
        borderRadius: o.shape === "ellipse" ? "50%" : o.shape === "roundRect" ? cornerRadius(o.width, o.height) : 0,
      }}
    />
  );
}

export function SlideCanvas({ presentation, slide, displayWidth, clip = true, hideObjectId = null }: Props) {
  const scale = displayWidth / presentation.width;
  return (
    <div
      className={`slide${clip ? "" : " slide--overflow"}`}
      style={{ width: displayWidth, height: presentation.height * scale }}
      role="img"
      aria-label={`${slide.name} preview`}
    >
      <div
        className="slide__inner"
        style={{ width: presentation.width, height: presentation.height, transform: `scale(${scale})` }}
      >
        {slide.objects
          .filter((o) => o.visible)
          .map((o) => (
            <div
              key={o.id}
              className={`slide__text slide__text--${o.role}${textClassNames(o)}${o.id === hideObjectId ? " slide__text--editing" : ""}`}
              data-text-id={o.id}
              dir={o.direction}
              style={{
                left: o.x,
                top: o.y,
                width: o.width,
                height: o.height,
                ...textStyle(o),
                transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined,
              }}
            >
              <ShapeLayer o={o} />
              {/* One block per line, the same structure the in-place editor uses, so text does not shift when editing starts. Lines carry no text. */}
              {o.shape !== "line" &&
                splitLines(o.text).map((line, i) => (
                  <div key={i} className="rt-line" data-level={line.level > 0 ? line.level : undefined}>
                    {line.content === "" ? <br /> : line.content}
                  </div>
                ))}
            </div>
          ))}
      </div>
    </div>
  );
}
