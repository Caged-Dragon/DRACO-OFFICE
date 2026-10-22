import type { Presentation, Slide } from "../../core/document-model/types";

interface Props {
  presentation: Pick<Presentation, "width" | "height">;
  slide: Slide;
  /** Rendered width in CSS px; the slide scales uniformly from its model size. */
  displayWidth: number;
}

export function SlideCanvas({ presentation, slide, displayWidth }: Props) {
  const scale = displayWidth / presentation.width;
  return (
    <div
      className="slide"
      style={{ width: displayWidth, height: presentation.height * scale }}
      role="img"
      aria-label={`${slide.name} preview`}
    >
      <div
        className="slide__inner"
        style={{ width: presentation.width, height: presentation.height, transform: `scale(${scale})` }}
      >
        {slide.objects.filter((o) => o.visible).map((o) => (
          <div
            key={o.id}
            className={`slide__text slide__text--${o.role}`}
            style={{
              left: o.x,
              top: o.y,
              width: o.width,
              height: o.height,
              fontSize: o.fontSize,
              transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined,
            }}
          >
            {o.text}
          </div>
        ))}
      </div>
    </div>
  );
}
