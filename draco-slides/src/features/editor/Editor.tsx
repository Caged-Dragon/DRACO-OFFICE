import { useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { MenuButton } from "../../components/menus/MenuButton";
import type { Presentation } from "../../core/document-model/types";
import { savePresentation } from "../../services/storage/presentationStore";
import { useApp } from "../../state/AppContext";
import { editorReducer, initEditorState } from "../../state/editorReducer";
import { CanvasViewport } from "../canvas/CanvasViewport";
import { createPointerStore } from "../canvas/pointerStore";
import { useCanvasView } from "../canvas/useCanvasView";
import { Ribbon } from "../ribbon/Ribbon";
import { PropertiesDialog } from "./PropertiesDialog";
import { RenameSlideDialog } from "./RenameSlideDialog";
import { SlidePane } from "./SlidePane";
import { StatusBar, type SaveStatus } from "./StatusBar";

interface Props {
  initial: Presentation;
}

export function Editor({ initial }: Props) {
  const { dispatch: appDispatch } = useApp();
  const [state, dispatch] = useReducer(editorReducer, initial, initEditorState);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [showSlidePane, setShowSlidePane] = useState(true);
  const [showTextPanel, setShowTextPanel] = useState(true);
  const [showProperties, setShowProperties] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const canvas = useCanvasView(initial.width, initial.height);
  const pointerStore = useMemo(createPointerStore, []);
  const first = useRef(true);
  const dirty = useRef(false);
  const { presentation, currentSlideId } = state;
  const latest = useRef(presentation);
  latest.current = presentation;
  const slide = presentation.slides.find((s) => s.id === currentSlideId) ?? presentation.slides[0];
  const index = presentation.slides.indexOf(slide);

  // Debounced autosave to IndexedDB. A failed save is surfaced, never swallowed.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      void savePresentation(presentation).catch(() => setStatus("error"));
      return;
    }
    dirty.current = true;
    setStatus("saving");
    const t = window.setTimeout(() => {
      savePresentation(presentation)
        .then(() => {
          if (latest.current === presentation) dirty.current = false;
          setStatus("saved");
        })
        .catch(() => setStatus("error"));
    }, 400);
    return () => window.clearTimeout(t);
  }, [presentation]);

  // Flush pending edits if the editor closes before the debounce fires.
  useEffect(
    () => () => {
      if (dirty.current) void savePresentation(latest.current);
    },
    [],
  );

  const go = (delta: number) => {
    const next = presentation.slides[index + delta];
    if (next) dispatch({ type: "selectSlide", slideId: next.id });
  };

  const deleteCurrent = () => {
    // No undo until a later release, so ask first.
    if (window.confirm(`Delete "${slide.name}"? This cannot be undone yet.`)) {
      dispatch({ type: "deleteSlide", slideId: slide.id });
    }
  };

  // PageUp / PageDown move between slides unless focus is in a text field or open menu.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, textarea, [role=menu]")) return;
    if (e.key === "PageDown") {
      e.preventDefault();
      go(1);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      go(-1);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="editor" onKeyDown={onKeyDown}>
      <header className="editor__bar">
        <MenuButton
          label="File"
          items={[
            { label: "Properties", onSelect: () => setShowProperties(true) },
            { label: "Back to home", onSelect: () => appDispatch({ type: "navigate", view: "home" }) },
            { label: "Close presentation", onSelect: () => appDispatch({ type: "closePresentation" }) },
          ]}
        />
        <input
          className="editor__title"
          aria-label="Presentation title"
          value={presentation.title}
          onChange={(e) => dispatch({ type: "renamePresentation", title: e.target.value })}
        />
      </header>

      <Ribbon
        index={index}
        slideCount={presentation.slides.length}
        onAddSlide={() => dispatch({ type: "addSlide" })}
        onDuplicateSlide={() => dispatch({ type: "duplicateSlide", slideId: slide.id })}
        onDeleteSlide={deleteCurrent}
        onRenameSlide={() => setRenaming(true)}
        onMoveUp={() => dispatch({ type: "moveSlide", slideId: slide.id, toIndex: index - 1 })}
        onMoveDown={() => dispatch({ type: "moveSlide", slideId: slide.id, toIndex: index + 1 })}
        onPrevious={() => go(-1)}
        onNext={() => go(1)}
        showSlidePane={showSlidePane}
        showTextPanel={showTextPanel}
        onToggleSlidePane={() => setShowSlidePane((v) => !v)}
        onToggleTextPanel={() => setShowTextPanel((v) => !v)}
        zoomPercent={canvas.percent}
        onZoomIn={canvas.zoomIn}
        onZoomOut={canvas.zoomOut}
        onFitZoom={canvas.zoomFit}
        onActualSize={canvas.zoomActual}
      />

      <div className="editor__body">
        {showSlidePane && (
          <SlidePane
            presentation={presentation}
            currentSlideId={slide.id}
            onSelect={(slideId) => dispatch({ type: "selectSlide", slideId })}
            onMove={(slideId, toIndex) => dispatch({ type: "moveSlide", slideId, toIndex })}
          />
        )}

        <section className="editor__stage" aria-label="Slide editor">
          <CanvasViewport
            canvas={canvas}
            slide={slide}
            width={presentation.width}
            height={presentation.height}
            onPointer={pointerStore.set}
          />
          {showTextPanel && (
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
          )}
        </section>
      </div>

      {showProperties && (
        <PropertiesDialog
          presentation={presentation}
          onClose={() => setShowProperties(false)}
          onSave={(values) => {
            dispatch({ type: "updateProperties", ...values });
            setShowProperties(false);
          }}
        />
      )}

      {renaming && (
        <RenameSlideDialog
          currentName={slide.name}
          onClose={() => setRenaming(false)}
          onSave={(name) => {
            dispatch({ type: "renameSlide", slideId: slide.id, name });
            setRenaming(false);
          }}
        />
      )}

      <StatusBar
        index={index}
        slideCount={presentation.slides.length}
        width={presentation.width}
        height={presentation.height}
        zoomPercent={canvas.percent}
        pointerStore={pointerStore}
        status={status}
      />
    </div>
  );
}
