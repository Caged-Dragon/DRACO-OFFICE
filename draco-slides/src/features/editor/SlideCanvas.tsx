import type { Presentation, Slide } from "../../core/document-model/types";
import { splitLines } from "../../core/document-model/lists";
import { textClassNames, textStyle } from "./textStyle";

interface Props {
  presentation: Pick<Presentation, "width" | "height">;
  slide: Slide;
  /** Rendered width in CSS px; the slide scales uniformly from its model size. */
  displayWidth: number;
  /** Clip objects that extend past the slide edge (thumbnails, presenting). The editing canvas shows them. */
  clip?: boolean;
  /** Object currently being edited in place; it is drawn by the editor instead. */
  hideObjectId?: string | null;
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
              className={`slide__text slide__text--${o.role}${textClassNames(o)}`}
              data-text-id={o.id}
              dir={o.direction}
              style={{
                left: o.x,
                top: o.y,
                width: o.width,
                height: o.height,
                ...textStyle(o),
                transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined,
                visibility: o.id === hideObjectId ? "hidden" : undefined,
              }}
            >
              {/* One block per line, the same structure the in-place editor uses, so text does not shift when editing starts. */}
              {splitLines(o.text).map((line, i) => (
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
