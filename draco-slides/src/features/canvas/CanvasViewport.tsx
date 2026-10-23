import { useEffect, useId, useRef, useState } from "react";
import type { Slide, SlideObject } from "../../core/document-model/types";
import { HANDLE_IDS, handleFraction, moveRect, resizeRect, type HandleId, type Rect } from "../../core/geometry/rect";
import type { Point } from "../../core/geometry/viewport";
import { SlideCanvas } from "../editor/SlideCanvas";
import { TextEditor, type EditExitReason } from "./TextEditor";
import type { CanvasView } from "./useCanvasView";

interface Props {
  canvas: CanvasView;
  slide: Slide;
  width: number;
  height: number;
  selectedObjectId: string | null;
  editingObjectId: string | null;
  /** Where the double-click that started editing happened, so the caret can go there. */
  editCaret: Point | null;
  onPointer: (p: Point | null) => void;
  onSelectObject: (id: string | null) => void;
  onChangeRect: (id: string, rect: Rect) => void;
  onDeleteSelected: () => void;
  onStartEditing: (id: string, caret: Point | null) => void;
  onTextChange: (id: string, text: string) => void;
  onStopEditing: (reason: EditExitReason) => void;
}

const PAN_STEP = 40;
/** A click that moves less than this many screen pixels is a click, not a drag, and never edits the document. */
const DRAG_THRESHOLD = 3;

export function CanvasViewport({
  canvas,
  slide,
  width,
  height,
  selectedObjectId,
  editingObjectId,
  editCaret,
  onPointer,
  onSelectObject,
  onChangeRect,
  onDeleteSelected,
  onStartEditing,
  onTextChange,
  onStopEditing,
}: Props) {
  const [spaceDown, setSpaceDown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const helpId = useId();
  const dragCleanup = useRef<(() => void) | null>(null);
  const { view } = canvas;
  const zoom = view.zoom;
  const selected = slide.objects.find((o) => o.id === selectedObjectId && o.visible) ?? null;
  const editing = slide.objects.find((o) => o.id === editingObjectId && o.visible && o.type === "text") ?? null;

  useEffect(() => () => dragCleanup.current?.(), []);

  /** Moves or resizes an object while the mouse button is held. Works in slide units, so zoom does not matter. */
  const beginObjectDrag = (start: Point, o: SlideObject, mode: "move" | HandleId) => {
    dragCleanup.current?.();
    const origin: Rect = { x: o.x, y: o.y, width: o.width, height: o.height };
    const startZoom = zoom;
    let started = false;
    const move = (e: MouseEvent) => {
      const screenDx = e.clientX - start.x;
      const screenDy = e.clientY - start.y;
      if (!started) {
        if (Math.hypot(screenDx, screenDy) < DRAG_THRESHOLD) return;
        started = true;
      }
      const dx = screenDx / startZoom;
      const dy = screenDy / startZoom;
      onChangeRect(o.id, mode === "move" ? moveRect(origin, dx, dy) : resizeRect(origin, mode, dx, dy));
    };
    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      dragCleanup.current = null;
      setDragging(false);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    dragCleanup.current = stop;
    setDragging(true);
  };

  const insideEditor = (target: EventTarget | null) => !!(target as HTMLElement | null)?.closest?.("[data-text-editor]");

  return (
    <div
      ref={canvas.containerRef}
      className={`viewport${spaceDown ? " viewport--pan" : ""}${canvas.panning ? " viewport--panning" : ""}${
        dragging ? " viewport--dragging" : ""
      }`}
      role="group"
      aria-label="Slide canvas"
      aria-describedby={helpId}
      tabIndex={0}
      onMouseDown={(e) => {
        // Clicks inside the text editor belong to the browser: caret placement and text selection.
        if (insideEditor(e.target)) return;
        // Middle button, or Space + left button, pans.
        if (e.button === 1 || (e.button === 0 && spaceDown)) {
          e.preventDefault();
          canvas.startPan({ x: e.clientX, y: e.clientY });
          return;
        }
        if (e.button !== 0) return;
        if (editing) onStopEditing("click"); // any click outside the editor finishes editing
        const target = e.target as HTMLElement;
        const handleEl = target.closest<HTMLElement>("[data-handle]");
        const objectEl = target.closest<HTMLElement>("[data-object-id]");
        if (handleEl && selected) {
          e.preventDefault();
          canvas.containerRef.current?.focus();
          beginObjectDrag({ x: e.clientX, y: e.clientY }, selected, handleEl.dataset.handle as HandleId);
        } else if (objectEl) {
          const o = slide.objects.find((x) => x.id === objectEl.dataset.objectId);
          if (!o) return;
          e.preventDefault(); // no text selection while dragging
          canvas.containerRef.current?.focus();
          onSelectObject(o.id);
          beginObjectDrag({ x: e.clientX, y: e.clientY }, o, "move");
        } else {
          onSelectObject(null); // click on empty canvas
        }
      }}
      onDoubleClick={(e) => {
        if (insideEditor(e.target)) return;
        const objectEl = (e.target as HTMLElement).closest<HTMLElement>("[data-object-id]");
        const o = objectEl && slide.objects.find((x) => x.id === objectEl.dataset.objectId);
        if (o && o.type === "text") onStartEditing(o.id, { x: e.clientX, y: e.clientY });
      }}
      onMouseMove={(e) => onPointer(canvas.toSlide(e.clientX, e.clientY))}
      onMouseLeave={() => onPointer(null)}
      onKeyDown={(e) => {
        // While typing in the text editor every key belongs to it (Space, Delete, arrows...).
        if (insideEditor(e.target)) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        const step = e.shiftKey ? PAN_STEP * 5 : PAN_STEP;
        switch (e.key) {
          case " ":
            e.preventDefault();
            setSpaceDown(true);
            break;
          case "+":
          case "=":
            e.preventDefault();
            canvas.zoomIn();
            break;
          case "-":
          case "_":
            e.preventDefault();
            canvas.zoomOut();
            break;
          case "0":
            e.preventDefault();
            canvas.zoomFit();
            break;
          case "Enter":
          case "F2":
            if (selected && selected.type === "text") {
              e.preventDefault();
              onStartEditing(selected.id, null);
            }
            break;
          case "Delete":
          case "Backspace":
            if (selected) {
              e.preventDefault();
              onDeleteSelected();
            }
            break;
          case "Escape":
            if (selectedObjectId) {
              e.preventDefault();
              onSelectObject(null);
            }
            break;
          case "ArrowLeft":
            e.preventDefault();
            canvas.panBy(step, 0);
            break;
          case "ArrowRight":
            e.preventDefault();
            canvas.panBy(-step, 0);
            break;
          case "ArrowUp":
            e.preventDefault();
            canvas.panBy(0, step);
            break;
          case "ArrowDown":
            e.preventDefault();
            canvas.panBy(0, -step);
            break;
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " ") setSpaceDown(false);
      }}
      onBlur={() => setSpaceDown(false)}
    >
      <span id={helpId} className="sr-only">
        Click an object to select it, drag to move, drag a handle to resize, Delete removes it. Press Enter or
        double-click a text object to edit its text, and Escape to finish. Plus and minus zoom, 0 fits the window,
        arrow keys pan, hold Space and drag to pan.
      </span>
      <div className="viewport__slide" style={{ left: view.panX, top: view.panY }}>
        <SlideCanvas
          presentation={{ width, height }}
          slide={slide}
          displayWidth={width * zoom}
          clip={false}
          hideObjectId={editing?.id ?? null}
        />
        {/* Interaction layer in screen pixels, so handles keep a constant size at every zoom. */}
        <div className="overlay" style={{ width: width * zoom, height: height * zoom }}>
          {slide.objects
            .filter((o) => o.visible && o.id !== editing?.id)
            .map((o) => (
              <div
                key={o.id}
                data-object-id={o.id}
                role="button"
                tabIndex={-1}
                aria-label={o.name}
                aria-pressed={o.id === selectedObjectId}
                className={`hit${o.id === selectedObjectId ? " hit--selected" : ""}`}
                style={{ left: o.x * zoom, top: o.y * zoom, width: o.width * zoom, height: o.height * zoom }}
              />
            ))}
          {selected &&
            !editing &&
            HANDLE_IDS.map((h) => {
              const { fx, fy } = handleFraction(h);
              return (
                <div
                  key={h}
                  data-handle={h}
                  data-testid={`handle-${h}`}
                  aria-hidden="true"
                  className={`handle handle--${h}`}
                  style={{ left: (selected.x + selected.width * fx) * zoom, top: (selected.y + selected.height * fy) * zoom }}
                />
              );
            })}
          {editing && editing.type === "text" && (
            <TextEditor
              key={editing.id}
              object={editing}
              zoom={zoom}
              caretPoint={editCaret}
              onTextChange={(text) => onTextChange(editing.id, text)}
              onExit={onStopEditing}
            />
          )}
        </div>
      </div>
    </div>
  );
}
