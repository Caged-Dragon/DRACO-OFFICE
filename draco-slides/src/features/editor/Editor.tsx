import { useEffect, useReducer, useRef, useState } from "react";
import type { Presentation } from "../../core/document-model/types";
import { savePresentation } from "../../services/storage/presentationStore";
import { editorReducer, initEditorState } from "../../state/editorReducer";
import { SlideCanvas } from "./SlideCanvas";

interface Props {
  initial: Presentation;
  onClose: () => void;
}

type SaveStatus = "saved" | "saving" | "error";

export function Editor({ initial, onClose }: Props) {
  const [state, dispatch] = useReducer(editorReducer, initial, initEditorState);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const first = useRef(true);
  const { presentation, currentSlideId } = state;
  const slide = presentation.slides.find((s) => s.id === currentSlideId) ?? presentation.slides[0];
  const index = presentation.slides.indexOf(slide);

  // Debounced autosave to IndexedDB. A failed save is surfaced, never swallowed.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      void savePresentation(presentation).catch(() => setStatus("error"));
      return;
    }
    setStatus("saving");
    const t = window.setTimeout(() => {
      savePresentation(presentation)
        .then(() => setStatus("saved"))
        .catch(() => setStatus("error"));
    }, 400);
    return () => window.clearTimeout(t);
  }, [presentation]);

  const go = (delta: number) => {
    const next = presentation.slides[index + delta];
    if (next) dispatch({ type: "selectSlide", slideId: next.id });
  };

  return (
    <div className="editor">
      <header className="editor__bar">
        <button className="btn" onClick={onClose}>Home</button>
        <input
          className="editor__title"
          aria-label="Presentation title"
          value={presentation.title}
          onChange={(e) => dispatch({ type: "renamePresentation", title: e.target.value })}
        />
        <div className="editor__actions" role="toolbar" aria-label="Slide actions">
          <button className="btn btn--primary" onClick={() => dispatch({ type: "addSlide" })}>
            New slide
          </button>
          <button
            className="btn"
            disabled={presentation.slides.length <= 1}
            onClick={() => dispatch({ type: "deleteSlide", slideId: slide.id })}
          >
            Delete slide
          </button>
        </div>
      </header>

      <div className="editor__body">
        <nav className="editor__nav" aria-label="Slides">
          <ol>
            {presentation.slides.map((s, i) => (
              <li key={s.id}>
                <button
                  className={`thumb${s.id === slide.id ? " thumb--active" : ""}`}
                  aria-current={s.id === slide.id ? "true" : undefined}
                  aria-label={`Slide ${i + 1}: ${s.name}`}
                  onClick={() => dispatch({ type: "selectSlide", slideId: s.id })}
                >
                  <span className="thumb__num">{i + 1}</span>
                  <SlideCanvas presentation={presentation} slide={s} displayWidth={160} />
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <main className="editor__stage">
          <SlideCanvas presentation={presentation} slide={slide} displayWidth={800} />
          <div className="editor__text">
            {slide.objects.map((o) => (
              <label key={o.id}>
                <span className="muted">{o.role === "title" ? "Title" : "Body text"}</span>
                <textarea
                  rows={o.role === "title" ? 1 : 3}
                  value={o.text}
                  onChange={(e) =>
                    dispatch({ type: "setObjectText", slideId: slide.id, objectId: o.id, text: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
        </main>
      </div>

      <footer className="editor__status" role="status">
        <span>
          Slide {index + 1} of {presentation.slides.length}
        </span>
        <span>
          <button className="btn btn--small" disabled={index === 0} onClick={() => go(-1)}>Previous</button>{" "}
          <button className="btn btn--small" disabled={index === presentation.slides.length - 1} onClick={() => go(1)}>Next</button>
        </span>
        <span className={status === "error" ? "error" : "muted"}>
          {status === "saved" && "Saved in this browser"}
          {status === "saving" && "Saving…"}
          {status === "error" && "Could not save. Your changes are still on screen; keep this tab open."}
        </span>
      </footer>
    </div>
  );
}
