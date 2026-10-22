import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Presentation } from "../../core/document-model/types";
import { SlideThumbnail } from "./SlideThumbnail";

interface Props {
  presentation: Presentation;
  currentSlideId: string;
  onSelect: (slideId: string) => void;
  onMove: (slideId: string, toIndex: number) => void;
}

export function SlidePane({ presentation, currentSlideId, onSelect, onMove }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const { slides, width, height } = presentation;

  // Keep the pane in step with the selection, whoever changed it (ribbon, status bar, PageUp/PageDown, deletion):
  // scroll the selected thumbnail into view, and if keyboard focus is already inside the pane, move it along.
  useEffect(() => {
    const el = buttons.current.get(currentSlideId);
    if (!el) return;
    if (navRef.current?.contains(document.activeElement)) el.focus();
    el.scrollIntoView?.({ block: "nearest" });
  }, [currentSlideId]);

  const endDrag = () => {
    setDragId(null);
    setOverId(null);
  };

  const onThumbKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.altKey) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onMove(slides[i].id, i - 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onMove(slides[i].id, i + 1);
      }
      return;
    }
    let target = -1;
    if (e.key === "ArrowUp") target = i - 1;
    else if (e.key === "ArrowDown") target = i + 1;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = slides.length - 1;
    if (target < 0 || target >= slides.length) return;
    e.preventDefault();
    onSelect(slides[target].id);
  };

  return (
    <nav className="editor__nav" aria-label="Slides" ref={navRef}>
      <ol>
        {slides.map((s, i) => (
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
              ref={(el) => {
                if (el) buttons.current.set(s.id, el);
                else buttons.current.delete(s.id);
              }}
              className={`thumb${s.id === currentSlideId ? " thumb--active" : ""}`}
              aria-current={s.id === currentSlideId ? "true" : undefined}
              aria-label={`Slide ${i + 1}: ${s.name}`}
              tabIndex={s.id === currentSlideId ? 0 : -1}
              title="Arrow keys move between slides. Drag, or Alt+Up / Alt+Down, to reorder."
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => onThumbKey(e, i)}
            >
              <span className="thumb__num">{i + 1}</span>
              <span className="thumb__body">
                <SlideThumbnail slide={s} width={width} height={height} displayWidth={160} />
                <span className="thumb__name">{s.name}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
