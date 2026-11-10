import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { APP_VERSION } from "../../app/version";
import { MenuButton } from "../../components/menus/MenuButton";
import type { BoxPatch } from "../../core/document-model/box";
import { boundsOf, isWholeGroup, rectOf } from "../../core/document-model/groups";
import { paragraphPatch } from "../../core/document-model/paragraph";
import type { Alignment, ParagraphFormat, Presentation, TextFormat } from "../../core/document-model/types";
import { minSize } from "../../core/document-model/shapes";
import { formatPatch } from "../../core/document-model/fonts";
import type { Point } from "../../core/geometry/viewport";
import { fileNameFor, serializePresentation } from "../../core/serialization/serialize";
import { savePresentation } from "../../services/storage/presentationStore";
import { describeStorageError } from "../../services/storage/storageError";
import { useApp } from "../../state/AppContext";
import { useSettings } from "../../state/SettingsContext";
import { historyReducer, initHistoryState } from "../../state/history";
import { downloadTextFile } from "../../utils/download";
import { Ruler } from "../canvas/Ruler";
import { CanvasViewport } from "../canvas/CanvasViewport";
import { createPointerStore } from "../canvas/pointerStore";
import { useCanvasView } from "../canvas/useCanvasView";
import { fitBoxHeight, fitFontSize } from "../canvas/fitText";
import type { TextEditorApi } from "../canvas/TextEditor";
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
  const { settings, update: updateSettings } = useSettings();
  const [history, dispatch] = useReducer(historyReducer, initial, initHistoryState);
  const state = history.present;
  const [historyNote, setHistoryNote] = useState("");
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
  const { presentation, currentSlideId, selectedObjectId, selectedObjectIds, editingObjectId } = state;
  const [editCaret, setEditCaret] = useState<Point | null>(null);
  const editorApi = useRef<TextEditorApi | null>(null);
  const [overflowIds, setOverflowIds] = useState<ReadonlySet<string>>(new Set());
  const latest = useRef(presentation);
  latest.current = presentation;
  const slide = presentation.slides.find((s) => s.id === currentSlideId) ?? presentation.slides[0];
  const index = presentation.slides.indexOf(slide);
  /** The one selected object (null when none or several are selected): text editing, formatting and the position fields use it. */
  const selectedObject = slide.objects.find((o) => o.id === selectedObjectId) ?? null;
  const selectedObjects = slide.objects.filter((o) => selectedObjectIds.includes(o.id));
  const selectionBounds = boundsOf(selectedObjects.map(rectOf));
  const wholeGroup = isWholeGroup(slide.objects, selectedObjectIds);
  const anyLocked = selectedObjects.some((o) => o.locked);
  const allLocked = selectedObjects.length > 0 && selectedObjects.every((o) => o.locked);
  const editingObject = slide.objects.find((o) => o.id === editingObjectId) ?? null;
  const dims = (r: { x: number; y: number; width: number; height: number }) =>
    `(${Math.round(r.x)}, ${Math.round(r.y)}, ${Math.round(r.width)} × ${Math.round(r.height)})`;
  const selectionLabel = selectedObject
    ? `${selectedObject.name} ${dims(selectedObject)}${editingObject ? " – editing text" : ""}${
        overflowIds.has(selectedObject.id) ? " – text overflows the box" : ""
      }${selectedObject.groupId ? " – in a group" : ""}${selectedObject.locked ? " – locked" : ""}`
    : selectionBounds
      ? `${wholeGroup ? `group of ${selectedObjects.length} objects` : `${selectedObjects.length} objects`} ${dims(selectionBounds)}${anyLocked ? " – locked" : ""}`
      : null;

  const notifyLocked = () => notify("info", "Locked objects can't be moved, resized or deleted. Unlock them first.");
  const deleteSelected = () => {
    if (selectedObjects.length === 0) return;
    if (anyLocked) notifyLocked();
    else dispatch({ type: "deleteSelection" });
  };

  // Lines carry no text, so text commands are off for them.
  const textObject = selectedObject?.type === "text" && selectedObject.shape !== "line" ? selectedObject : null;
  const formatSelected = (patch: Partial<Record<keyof TextFormat, unknown>>) => {
    if (textObject) dispatch({ type: "setTextFormat", objectId: textObject.id, patch });
  };
  const paragraphSelected = (patch: Partial<Record<keyof ParagraphFormat, unknown>>) => {
    if (textObject) dispatch({ type: "setParagraphFormat", objectId: textObject.id, patch });
  };
  const boxSelected = (patch: BoxPatch) => {
    if (textObject) dispatch({ type: "setBoxFormat", objectId: textObject.id, patch });
  };

  /** One-shot fitting, measured on the text as it is drawn on the canvas. Not a live autofit mode. */
  const fitSelected = (mode: "shrink" | "resize") => {
    if (!textObject) return;
    const el = canvas.containerRef.current?.querySelector<HTMLElement>(`[data-text-id="${textObject.id}"]`) ?? null;
    const unavailable = () => notify("info", "Fitting needs the slide to be shown on screen, so nothing was changed.");
    if (!el) return unavailable();
    if (mode === "shrink") {
      const result = fitFontSize(el, textObject.fontSize);
      if (!result) return unavailable();
      if (result.size === textObject.fontSize) {
        notify("info", result.fits ? "The text already fits." : "The text does not fit even at the smallest size. Make the box larger.");
        return;
      }
      formatSelected({ fontSize: result.size });
      if (!result.fits) notify("info", "The text still does not fit at the smallest size. Make the box larger.");
    } else {
      const height = fitBoxHeight(el);
      if (height === null) return unavailable();
      if (Math.abs(height - textObject.height) < 1) {
        notify("info", "The box already fits its text.");
        return;
      }
      dispatch({
        type: "setObjectRect",
        objectId: textObject.id,
        rect: { x: textObject.x, y: textObject.y, width: textObject.width, height },
      });
    }
  };

  const alignSelected = (align: Alignment) => paragraphSelected(paragraphPatch("align", align));
  /** While editing, the editing surface changes the levels of the paragraphs in the selection; otherwise all paragraphs move. */
  const changeListLevel = (delta: 1 | -1) => {
    if (!textObject) return;
    if (editingObject?.id === textObject.id && editorApi.current) editorApi.current.changeLevel(delta);
    else dispatch({ type: "shiftListLevel", objectId: textObject.id, delta });
  };
  const toggleFormat = (key: "bold" | "italic" | "underline" | "strike") => {
    if (textObject) formatSelected(formatPatch(key, !textObject[key]));
  };

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

  // Announce a newly selected object or group (clearing the selection is not announced).
  useEffect(() => {
    if (selectedObject) setAnnouncement(`Selected ${selectedObject.name}`);
    else if (selectedObjects.length > 1) {
      setAnnouncement(wholeGroup ? `Group of ${selectedObjects.length} objects selected` : `${selectedObjects.length} objects selected`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObjectIds.join(",")]);

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
  const undoLabel = history.past[history.past.length - 1]?.label ?? null;
  const redoLabel = history.future[history.future.length - 1]?.label ?? null;
  const undo = () => {
    if (!undoLabel) return;
    dispatch({ type: "undo" });
    setHistoryNote(`Undid ${undoLabel}`);
  };
  const redo = () => {
    if (!redoLabel) return;
    dispatch({ type: "redo" });
    setHistoryNote(`Redid ${redoLabel}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Text fields and the text editor keep the browser's own undo while you type in them.
    if ((e.target as HTMLElement).closest("input, textarea, [role=menu], [contenteditable=true]")) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (k === "y") {
        e.preventDefault();
        redo();
        return;
      }
    }
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
        <button
          className="btn"
          aria-label="Undo"
          title={undoLabel ? `Undo ${undoLabel} (Ctrl+Z)` : "Nothing to undo"}
          disabled={!undoLabel}
          onClick={undo}
        >
          Undo
        </button>
        <button
          className="btn"
          aria-label="Redo"
          title={redoLabel ? `Redo ${redoLabel} (Ctrl+Y)` : "Nothing to redo"}
          disabled={!redoLabel}
          onClick={redo}
        >
          Redo
        </button>
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
        hasSelection={selectedObjects.length > 0}
        selectionCount={selectedObjects.length}
        canGroup={selectedObjects.length >= 2 && !wholeGroup}
        canUngroup={selectedObjects.some((o) => o.groupId !== null)}
        allLocked={allLocked}
        onGroup={() => dispatch({ type: "groupSelection" })}
        onUngroup={() => dispatch({ type: "ungroupSelection" })}
        onToggleLock={() => dispatch({ type: "setObjectsLocked", locked: !allLocked })}
        onSelectAll={() => dispatch({ type: "selectAllObjects" })}
        canEditText={textObject !== null}
        onEditText={() => selectedObject && startEditing(selectedObject.id, null)}
        format={textObject}
        onFormat={formatSelected}
        onParagraph={paragraphSelected}
        onListLevel={changeListLevel}
        onBox={boxSelected}
        onAddShape={(shape) => dispatch({ type: "addShape", shape })}
        positionMin={selectedObject ? minSize(selectedObject) : { width: 20, height: 20 }}
        position={selectedObject && !selectedObject.locked ? { x: selectedObject.x, y: selectedObject.y, width: selectedObject.width, height: selectedObject.height } : null}
        slideSize={{ width: presentation.width, height: presentation.height }}
        viewOptions={settings}
        onViewOptions={(patch) => updateSettings({ ...settings, ...patch })}
        onRect={(rect) => selectedObject && dispatch({ type: "setObjectRect", objectId: selectedObject.id, rect })}
        onFit={fitSelected}
        onAddTextBox={() => dispatch({ type: "addTextBox" })}
        onDeleteObject={deleteSelected}
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
          <div className={`canvas-area${settings.showRulers ? " canvas-area--rulers" : ""}`}>
            {settings.showRulers && (
              <>
                <div className="canvas-area__corner" aria-hidden="true" />
                <Ruler
                  orientation="horizontal"
                  view={canvas.view}
                  length={canvas.size.width}
                  slideLength={presentation.width}
                  selection={selectionBounds ? [selectionBounds.x, selectionBounds.x + selectionBounds.width] : null}
                />
                <Ruler
                  orientation="vertical"
                  view={canvas.view}
                  length={canvas.size.height}
                  slideLength={presentation.height}
                  selection={selectionBounds ? [selectionBounds.y, selectionBounds.y + selectionBounds.height] : null}
                />
              </>
            )}
          <CanvasViewport
            canvas={canvas}
            slide={slide}
            width={presentation.width}
            height={presentation.height}
            selectedObjectIds={selectedObjectIds}
            editingObjectId={editingObject?.id ?? null}
            editCaret={editCaret}
            onStartEditing={startEditing}
            onTextChange={(objectId, text) =>
              dispatch({ type: "setObjectText", slideId: slide.id, objectId, text })
            }
            onStopEditing={stopEditing}
            onToggleFormat={toggleFormat}
            onAlign={alignSelected}
            onOverflowChange={setOverflowIds}
            snap={{ objects: settings.snapToObjects, grid: settings.snapToGrid ? settings.gridSize : null }}
            gridLines={settings.showGrid ? settings.gridSize : null}
            registerEditorApi={(api) => {
              editorApi.current = api;
            }}
            onPointer={pointerStore.set}
            onSelectObjects={(objectIds, expand) => dispatch({ type: "selectObjects", objectIds, expand })}
            onToggleObject={(objectId) => dispatch({ type: "toggleObjectSelection", objectId })}
            onSelectAll={() => dispatch({ type: "selectAllObjects" })}
            onChangeRect={(objectId, rect) => dispatch({ type: "setObjectRect", objectId, rect })}
            onChangeRects={(rects) => dispatch({ type: "setObjectRects", rects })}
            onDeleteSelected={deleteSelected}
            onGroup={() => dispatch({ type: "groupSelection" })}
            onUngroup={() => dispatch({ type: "ungroupSelection" })}
            onLockedAttempt={notifyLocked}
            onGestureEnd={() => dispatch({ type: "breakHistory" })}
          />
          </div>
          {showTextPanel && (
            <div className="editor__text">
              {slide.objects.filter((o) => o.shape !== "line").map((o) => (
                <label key={o.id} className={selectedObjectIds.includes(o.id) ? "editor__field--selected" : undefined}>
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

      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="history-note">
        {historyNote}
      </div>
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
