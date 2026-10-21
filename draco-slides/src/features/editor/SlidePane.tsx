import type { Presentation } from "../../core/document-model/types";
import { SlideCanvas } from "./SlideCanvas";

interface Props {
  presentation: Presentation;
  currentSlideId: string;
  onSelect: (slideId: string) => void;
}

export function SlidePane({ presentation, currentSlideId, onSelect }: Props) {
  return (
    <nav className="editor__nav" aria-label="Slides">
      <ol>
        {presentation.slides.map((s, i) => (
          <li key={s.id}>
            <button
              className={`thumb${s.id === currentSlideId ? " thumb--active" : ""}`}
              aria-current={s.id === currentSlideId ? "true" : undefined}
              aria-label={`Slide ${i + 1}: ${s.name}`}
              onClick={() => onSelect(s.id)}
            >
              <span className="thumb__num">{i + 1}</span>
              <SlideCanvas presentation={presentation} slide={s} displayWidth={160} />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
