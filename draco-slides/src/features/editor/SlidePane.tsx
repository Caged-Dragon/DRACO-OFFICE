import { useState } from "react";
import type { Presentation } from "../../core/document-model/types";
import { SlideCanvas } from "./SlideCanvas";

interface Props {
  presentation: Presentation;
  currentSlideId: string;
  onSelect: (slideId: string) => void;
  onMove: (slideId: string, toIndex: number) => void;
}

export function SlidePane({ presentation, currentSlideId, onSelect, onMove }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const endDrag = () => {
    setDragId(null);
    setOverId(null);
  };

  return (
    <nav className="editor__nav" aria-label="Slides">
      <ol>
        {presentation.slides.map((s, i) => (
          <li
            key={s.id}
            draggable
            className={`slidepane__item${dragId === s.id ? " slidepane__item--dragging" : ""}${
              overId === s.id && dragId !== s.id ? " slidepane__item--over" : ""
            }`}
            onDragStart={(e) => {
              setDragId(s.id);
              e.dataTransfer?.setData("text/plain", s.id);
              if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(s.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== s.id) onMove(dragId, i);
              endDrag();
            }}
            onDragEnd={endDrag}
          >
            <button
              className={`thumb${s.id === currentSlideId ? " thumb--active" : ""}`}
              aria-current={s.id === currentSlideId ? "true" : undefined}
              aria-label={`Slide ${i + 1}: ${s.name}`}
              title="Drag to reorder, or press Alt+Up / Alt+Down"
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => {
                if (!e.altKey) return;
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  onMove(s.id, i - 1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  onMove(s.id, i + 1);
                }
              }}
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
