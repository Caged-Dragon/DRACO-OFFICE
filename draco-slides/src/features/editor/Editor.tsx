import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { APP_VERSION } from "../../app/version";
import { MenuButton } from "../../components/menus/MenuButton";
import type { Presentation } from "../../core/document-model/types";
import type { Point } from "../../core/geometry/viewport";
import { fileNameFor, serializePresentation } from "../../core/serialization/serialize";
import { savePresentation } from "../../services/storage/presentationStore";
import { describeStorageError } from "../../services/storage/storageError";
import { useApp } from "../../state/AppContext";
import { useSettings } from "../../state/SettingsContext";
import { editorReducer, initEditorState } from "../../state/editorReducer";
import { downloadTextFile } from "../../utils/download";
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
  const { dispatch: appDispatch, notify } = useApp();
  const { settings } = useSettings();
  const [state, dispatch] = useReducer(editorReducer, initial, initEditorState);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSlidePane, setShowSlidePane] = useState(settings.showSlidePane);
  const [showTextPanel, setShowTextPanel] = useState(settings.showTextPanel);
  const [showProperties, setShowProperties] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const announcedSlide = useRef(initial.slides[0].id);
  const canvas = useCanvasView(initial.width, initial.height);
  const pointerStore = useMemo(createPointerStore, []);
  const first = useRef(true);
  const dirty = useRef(false);
  const { presentation, currentSlideId, selectedObjectId, editingObjectId } = state;
  const [editCaret, setEditCaret] = useState<Point | null>(null);
  const latest = useRef(presentation);
  latest.current = presentation;
  const slide = presentation.slides.find((s) => s.id === currentSlideId) ?? presentation.slides[0];
  const index = presentation.slides.indexOf(slide);
  const selectedObject = slide.objects.find((o) => o.id === selectedObjectId) ?? null;
  const editingObject = slide.objects.find((o) => o.id === editingObjectId) ?? null;
  const selectionLabel = selectedObject
    ? `${selectedObject.name} (${Math.round(selectedObject.x)}, ${Math.round(selectedObject.y)}, ${Math.round(selectedObject.width)} × ${Math.round(selectedObject.height)})${
        editingObject ? " – editing text" : ""
      }`
    : null;

  const startEditing = (objectId: string, caret: Point | null) => {
    setEditCaret(caret);
    dispatch({ type: "startEditing", objectId });
  };
  const stopEditing = (reason: "escape" | "blur" | "click") => {
    dispatch({ type: "stopEditing" });
    if (reason === "escape") canvas.containerRef.current?.focus(); // keep keyboard users on the canvas
  };

  // Tell screen-reader users which slide is now selected (not on reordering, and not on first load).
  useEffect(() => {
    if (announcedSlide.current === slide.id) return;
    announcedSlide.current = slide.id;
    setAnnouncement(`Slide ${index + 1} of ${presentation.slides.length}: ${slide.name}`);
  }, [slide.id, slide.name, index, presentation.slides.length]);

  useEffect(() => {
    if (editingObject) setAnnouncement(`Editing ${editingObject.name}. Press Escape to finish.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingObject?.id]);

  // Announce a newly selected object (clearing the selection is not announced).
  useEffect(() => {
    if (selectedObject) setAnnouncement(`Selected ${selectedObject.name}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObject?.id]);

  /** Saves a snapshot. Status only changes to "saved" if no newer edit is waiting. */
  const persist = useCallback(async (p: Presentation) => {
    try {
      await savePresentation(p);
      if (latest.current === p) {
        dirty.current = false;
        setStatus("saved");
        setSaveError(null);
      }
    } catch (e) {
      setStatus("error");
      setSaveError(describeStorageError(e));
    }
  }, []);

  // Debounced autosave. A failed save is surfaced with its reason, never swallowed.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      void persist(presentation);
      return;
    }
    dirty.current = true;
    setStatus("saving");
    const t = window.setTimeout(() => void persist(presentation), 400);
    return () => window.clearTimeout(t);
  }, [presentation, persist]);

  // Save immediately when the page is being hidden or closed, and when the editor closes with edits pending.
  useEffect(() => {
    const flush = () => {
      if (dirty.current) void persist(latest.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      if (dirty.current) {
        const p = latest.current;
        savePresentation(p).catch((e) =>
          notify("error", `Could not save "${p.title}": ${describeStorageError(e)} Your last changes were not stored.`),
        );
      }
    };
  }, [persist, notify]);

  // Warn before leaving the page while changes are unsaved or a save has failed.
  useEffect(() => {
    if (status === "saved") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  const downloadCopy = () =>
    downloadTextFile(fileNameFor(latest.current.title), serializePresentation(latest.current, APP_VERSION));

  const retrySave = () => {
    setStatus("saving");
    void persist(latest.current);
  };

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
    if ((e.target as HTMLElement).closest("input, textarea, [role=menu], [contenteditable=true]")) return;
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
            { label: "Save a copy to file", onSelect: downloadCopy },
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
        hasSelection={selectedObject !== null}
        canEditText={selectedObject?.type === "text"}
        onEditText={() => selectedObject && startEditing(selectedObject.id, null)}
        onAddTextBox={() => dispatch({ type: "addTextBox" })}
        onDeleteObject={() => selectedObject && dispatch({ type: "deleteObject", objectId: selectedObject.id })}
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
            selectedObjectId={selectedObject?.id ?? null}
            editingObjectId={editingObject?.id ?? null}
            editCaret={editCaret}
            onStartEditing={startEditing}
            onTextChange={(objectId, text) =>
              dispatch({ type: "setObjectText", slideId: slide.id, objectId, text })
            }
            onStopEditing={stopEditing}
            onPointer={pointerStore.set}
            onSelectObject={(objectId) => dispatch({ type: "selectObject", objectId })}
            onChangeRect={(objectId, rect) => dispatch({ type: "setObjectRect", objectId, rect })}
            onDeleteSelected={() => selectedObject && dispatch({ type: "deleteObject", objectId: selectedObject.id })}
          />
          {showTextPanel && (
            <div className="editor__text">
              {slide.objects.map((o) => (
                <label key={o.id} className={o.id === selectedObject?.id ? "editor__field--selected" : undefined}>
                  <span className="muted">{o.role === "title" ? "Title" : o.role === "body" ? "Body text" : o.name}</span>
                  <textarea
                    rows={o.role === "body" ? 3 : 1}
                    value={o.text}
                    onFocus={() => dispatch({ type: "selectObject", objectId: o.id })}
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

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <StatusBar
        index={index}
        slideCount={presentation.slides.length}
        width={presentation.width}
        height={presentation.height}
        zoomPercent={canvas.percent}
        selectionLabel={selectionLabel}
        pointerStore={pointerStore}
        status={status}
        saveError={saveError}
        onRetry={retrySave}
        onDownloadBackup={downloadCopy}
      />
    </div>
  );
}
