import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { boundsOf, expandSelection, minBoundsSize, rectOf, scaleRect } from "../../core/document-model/groups";
import type { Alignment, Slide } from "../../core/document-model/types";
import {
  HANDLE_IDS,
  constrainRect,
  handleFraction,
  lockAxis,
  moveRect,
  resizeRect,
  type HandleId,
  type Rect,
} from "../../core/geometry/rect";
import { snapMove, snapResize, type Guide, type SnapOptions } from "../../core/geometry/snap";
import type { Point } from "../../core/geometry/viewport";
import { SlideCanvas } from "../editor/SlideCanvas";
import { textOverflows } from "./fitText";
import { TextEditor, type EditExitReason, type FormatToggle, type TextEditorApi } from "./TextEditor";
import type { CanvasView } from "./useCanvasView";

interface Props {
  canvas: CanvasView;
  slide: Slide;
  width: number;
  height: number;
  /** Selected objects in stacking order. */
  selectedObjectIds: string[];
  editingObjectId: string | null;
  /** Where the double-click that started editing happened, so the caret can go there. */
  editCaret: Point | null;
  onPointer: (p: Point | null) => void;
  /** Replaces the selection. Selecting a group member selects the whole group unless `expand` is false. */
  onSelectObjects: (ids: string[], expand?: boolean) => void;
  /** Shift/Ctrl/Cmd+click: adds or removes an object (and its group). */
  onToggleObject: (id: string) => void;
  onSelectAll: () => void;
  /** Moves or resizes one object (the reducer keeps it on the slide). */
  onChangeRect: (id: string, rect: Rect) => void;
  /** Moves or scales several objects together; the caller has already kept the whole selection on the slide. */
  onChangeRects: (rects: Record<string, Rect>) => void;
  onDeleteSelected: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  /** The user tried to move, resize or delete locked objects. */
  onLockedAttempt: () => void;
  /** A drag or a run of nudges has ended: the next change is a new undo step. */
  onGestureEnd: () => void;
  onStartEditing: (id: string, caret: Point | null) => void;
  onTextChange: (id: string, text: string) => void;
  onStopEditing: (reason: EditExitReason) => void;
  onToggleFormat: (key: FormatToggle) => void;
  onAlign: (align: Alignment) => void;
  registerEditorApi: (api: TextEditorApi | null) => void;
  /** Called with the ids of the text objects whose text does not fit their box (only measurable in a real browser). */
  onOverflowChange: (ids: ReadonlySet<string>) => void;
  /** What dragging snaps to: objects (slide edges, centers and other objects) and/or a grid of this many pixels. */
  snap: { objects: boolean; grid: number | null };
  /** Grid spacing to draw, or null for no gridlines. */
  gridLines: number | null;
}

const PAN_STEP = 40;
const ARROW_DIRECTIONS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
/** A click that moves less than this many screen pixels is a click, not a drag, and never edits the document. */
const DRAG_THRESHOLD = 3;
/** How close, in screen pixels, an edge must get to a target before it snaps. */
const SNAP_SCREEN_PX = 6;
/** Gridlines closer together than this many screen pixels are not drawn. */
const MIN_GRID_SPACING_PX = 4;

export function CanvasViewport({
  canvas,
  slide,
  width,
  height,
  selectedObjectIds,
  editingObjectId,
  editCaret,
  onPointer,
  onSelectObjects,
  onToggleObject,
  onSelectAll,
  onChangeRect,
  onChangeRects,
  onDeleteSelected,
  onGroup,
  onUngroup,
  onLockedAttempt,
  onGestureEnd,
  onStartEditing,
  onTextChange,
  onStopEditing,
  onToggleFormat,
  onAlign,
  registerEditorApi,
  onOverflowChange,
  snap,
  gridLines,
}: Props) {
  const [spaceDown, setSpaceDown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const helpId = useId();
  const dragCleanup = useRef<(() => void) | null>(null);
  const { view } = canvas;
  const zoom = view.zoom;
  const idSet = new Set(selectedObjectIds);
  const selectedObjs = slide.objects.filter((o) => o.visible && idSet.has(o.id));
  /** The one selected object, or null when none or several are selected. */
  const selected = selectedObjs.length === 1 ? selectedObjs[0] : null;
  const anyLocked = selectedObjs.some((o) => o.locked);
  const box = boundsOf(selectedObjs.map(rectOf));
  const editing = slide.objects.find((o) => o.id === editingObjectId && o.visible && o.type === "text") ?? null;

  useEffect(() => () => dragCleanup.current?.(), []);

  // After every render, find text that does not fit its box. Cheap: a handful of elements per slide.
  const [overflowing, setOverflowing] = useState<ReadonlySet<string>>(new Set());
  useLayoutEffect(() => {
    const root = canvas.containerRef.current;
    if (!root) return;
    const ids = new Set<string>();
    root.querySelectorAll<HTMLElement>("[data-text-id]").forEach((el) => {
      if (el.dataset.textId && textOverflows(el)) ids.add(el.dataset.textId);
    });
    setOverflowing((prev) => (prev.size === ids.size && [...ids].every((id) => prev.has(id)) ? prev : ids));
  });
  useEffect(() => onOverflowChange(overflowing), [overflowing, onOverflowChange]);

  /**
   * Moves or resizes the given objects while the mouse button is held. Works in slide units, so zoom does not matter.
   * Several objects are treated as one rectangle (their bounds): moving translates them all, a handle scales them
   * together. `reduceTo`: if the button is released without a drag, the selection shrinks to that object.
   */
  const beginDrag = (start: Point, ids: string[], mode: "move" | HandleId, reduceTo?: string) => {
    dragCleanup.current?.();
    const objs = slide.objects.filter((o) => o.visible && ids.includes(o.id));
    if (objs.length === 0) return;
    const origins = objs.map(rectOf);
    const bounds = boundsOf(origins) as Rect;
    const single = objs.length === 1;
    const minSize = minBoundsSize(origins, bounds);
    const startZoom = zoom;
    let started = false;
    const snapOptions: SnapOptions = {
      slide: { width, height },
      others: slide.objects.filter((o) => o.visible && !ids.includes(o.id)).map(rectOf),
      objects: snap.objects,
      grid: snap.grid,
      threshold: SNAP_SCREEN_PX / startZoom,
    };
    const apply = (next: Rect) => {
      if (single) onChangeRect(objs[0].id, next);
      else onChangeRects(Object.fromEntries(objs.map((o, i) => [o.id, scaleRect(origins[i], bounds, next)])));
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      dragCleanup.current = null;
      setDragging(false);
      setGuides([]);
    };
    const move = (e: MouseEvent) => {
      const screenDx = e.clientX - start.x;
      const screenDy = e.clientY - start.y;
      if (!started) {
        if (Math.hypot(screenDx, screenDy) < DRAG_THRESHOLD) return;
        started = true;
        if (objs.some((o) => o.locked)) {
          onLockedAttempt();
          cleanup();
          return;
        }
      }
      const dx = screenDx / startZoom;
      const dy = screenDy / startZoom;
      // Shift: slide along one axis (moving) or keep the proportions (corner handles). Ctrl/Cmd: resize around the center.
      // Snapping is off while Alt is held. Resizing around the center or with locked proportions is not snapped.
      const snapping = (snap.objects || snap.grid !== null) && !e.altKey;
      if (mode === "move") {
        const [mx, my] = e.shiftKey ? lockAxis(dx, dy) : [dx, dy];
        let next = moveRect(bounds, mx, my);
        if (snapping) {
          const result = snapMove(next, snapOptions);
          next = result.rect;
          setGuides(result.guides);
        } else setGuides([]);
        // Several objects must stay together, so the whole selection is kept on the slide as one.
        apply(single ? next : constrainRect(next, { width, height }));
      } else {
        const fromCenter = e.ctrlKey || e.metaKey;
        const keepAspect = e.shiftKey;
        let next = resizeRect(bounds, mode, dx, dy, { keepAspect, fromCenter, minWidth: minSize.width, minHeight: minSize.height });
        if (snapping && !fromCenter && !(keepAspect && mode.length === 2)) {
          const result = snapResize(next, mode, snapOptions);
          if (result.rect.width >= minSize.width - 1e-6 && result.rect.height >= minSize.height - 1e-6) {
            next = result.rect;
            setGuides(result.guides);
          } else setGuides([]);
        } else setGuides([]);
        apply(next);
      }
    };
    const up = () => {
      cleanup();
      onGestureEnd();
      // A plain click on an already selected object in a larger selection narrows the selection to it.
      if (!started && reduceTo) onSelectObjects([reduceTo], false);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    dragCleanup.current = cleanup;
    setDragging(true);
  };

  /** Rubber-band selection: dragging on empty canvas selects the objects the rectangle completely encloses. */
  const beginMarquee = (start: Point, additive: boolean) => {
    dragCleanup.current?.();
    const startSlide = canvas.toSlide(start.x, start.y);
    const base = additive ? selectedObjectIds : [];
    let started = false;
    const rectTo = (clientX: number, clientY: number): Rect => {
      const p = canvas.toSlide(clientX, clientY);
      return { x: Math.min(startSlide.x, p.x), y: Math.min(startSlide.y, p.y), width: Math.abs(p.x - startSlide.x), height: Math.abs(p.y - startSlide.y) };
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      dragCleanup.current = null;
      setMarquee(null);
    };
    const move = (e: MouseEvent) => {
      if (!started) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD) return;
        started = true;
      }
      setMarquee(rectTo(e.clientX, e.clientY));
    };
    const up = (e: MouseEvent) => {
      const dragged = started;
      const r = rectTo(e.clientX, e.clientY);
      cleanup();
      if (!dragged) return;
      const inside = slide.objects
        .filter((o) => o.visible && o.x >= r.x && o.y >= r.y && o.x + o.width <= r.x + r.width && o.y + o.height <= r.y + r.height)
        .map((o) => o.id);
      onSelectObjects([...base, ...inside]);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    dragCleanup.current = cleanup;
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
        const start = { x: e.clientX, y: e.clientY };
        const additive = e.shiftKey || e.ctrlKey || e.metaKey;
        const target = e.target as HTMLElement;
        const handleEl = target.closest<HTMLElement>("[data-handle]");
        const objectEl = target.closest<HTMLElement>("[data-object-id]");
        if (handleEl && selectedObjs.length > 0) {
          e.preventDefault();
          canvas.containerRef.current?.focus();
          beginDrag(start, selectedObjs.map((o) => o.id), handleEl.dataset.handle as HandleId);
        } else if (objectEl) {
          const o = slide.objects.find((x) => x.id === objectEl.dataset.objectId);
          if (!o) return;
          e.preventDefault(); // no text selection while dragging
          canvas.containerRef.current?.focus();
          if (additive) {
            onToggleObject(o.id);
          } else if (idSet.has(o.id)) {
            // Dragging an already selected object moves the whole selection.
            beginDrag(start, selectedObjs.map((x) => x.id), "move", selectedObjs.length > 1 ? o.id : undefined);
          } else {
            onSelectObjects([o.id]);
            beginDrag(start, expandSelection(slide.objects, [o.id]), "move");
          }
        } else {
          // Empty canvas: clear the selection (unless adding to it) and start a rubber-band selection.
          if (!additive) onSelectObjects([]);
          beginMarquee(start, additive);
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
        // Ctrl/Cmd+A selects all objects; Ctrl/Cmd+G groups the selection, Ctrl/Cmd+Shift+G ungroups it.
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
          const k = e.key.toLowerCase();
          if (k === "a") {
            e.preventDefault();
            onSelectAll();
            return;
          }
          if (k === "g") {
            e.preventDefault();
            if (e.shiftKey) onUngroup();
            else onGroup();
            return;
          }
        }
        // Ctrl/Cmd+B, I, U format the selected text object.
        if ((e.ctrlKey || e.metaKey) && !e.altKey && selected?.type === "text") {
          const key = ({ b: "bold", i: "italic", u: "underline" } as Record<string, FormatToggle>)[e.key.toLowerCase()];
          if (key) {
            e.preventDefault();
            onToggleFormat(key);
            return;
          }
          // Ctrl/Cmd+L, E, R, J align (PowerPoint's shortcuts; the browser may reserve some of them).
          const align = ({ l: "left", e: "center", r: "right", j: "justify" } as Record<string, Alignment>)[e.key.toLowerCase()];
          if (align) {
            e.preventDefault();
            onAlign(align);
            return;
          }
        }
        // With objects selected the arrow keys move them (10 px, or 1 px with Ctrl/Cmd) and Shift+arrows resize them
        // (right and down grow, left and up shrink, from the top-left corner). With nothing selected they pan.
        const arrow = ARROW_DIRECTIONS[e.key];
        if (selectedObjs.length > 0 && arrow && !e.altKey) {
          e.preventDefault();
          if (anyLocked) {
            onLockedAttempt();
            return;
          }
          const amount = e.ctrlKey || e.metaKey ? 1 : 10;
          if (selected) {
            const rect = rectOf(selected);
            onChangeRect(
              selected.id,
              e.shiftKey ? resizeRect(rect, "se", arrow[0] * amount, arrow[1] * amount) : moveRect(rect, arrow[0] * amount, arrow[1] * amount),
            );
          } else if (box) {
            const origins = selectedObjs.map(rectOf);
            const min = minBoundsSize(origins, box);
            const next = e.shiftKey
              ? resizeRect(box, "se", arrow[0] * amount, arrow[1] * amount, { minWidth: min.width, minHeight: min.height })
              : constrainRect(moveRect(box, arrow[0] * amount, arrow[1] * amount), { width, height });
            onChangeRects(Object.fromEntries(selectedObjs.map((o, i) => [o.id, scaleRect(origins[i], box, next)])));
          }
          return;
        }
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
          case "Tab": {
            // Tab and Shift+Tab walk through the objects (back to front, a group counts as one stop). Past the last
            // (or before the first) the selection is cleared and focus moves on normally: no keyboard trap.
            const objs = slide.objects.filter((o) => o.visible);
            const at = objs.map((o, i) => (idSet.has(o.id) ? i : -1)).filter((i) => i >= 0);
            const to = at.length === 0 ? (e.shiftKey ? -1 : 0) : e.shiftKey ? Math.min(...at) - 1 : Math.max(...at) + 1;
            if (to >= 0 && to < objs.length) {
              e.preventDefault();
              onSelectObjects([objs[to].id]);
            } else if (at.length > 0) {
              onSelectObjects([]);
            }
            break;
          }
          case "Enter":
          case "F2":
            if (selected && selected.type === "text") {
              e.preventDefault();
              onStartEditing(selected.id, null);
            }
            break;
          case "Delete":
          case "Backspace":
            if (selectedObjs.length > 0) {
              e.preventDefault();
              onDeleteSelected();
            }
            break;
          case "Escape":
            if (selectedObjectIds.length > 0) {
              e.preventDefault();
              onSelectObjects([]);
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
        if (ARROW_DIRECTIONS[e.key]) onGestureEnd(); // releasing an arrow key ends a nudge
      }}
      onBlur={() => setSpaceDown(false)}
    >
      <span id={helpId} className="sr-only">
        Click an object or press Tab to select it; Shift+click adds to the selection, drag on empty canvas to select
        several, Control+A selects all, Control+G groups and Control+Shift+G ungroups. Arrow keys move the selected
        objects by 10 pixels, or 1 with Control; Shift and arrow keys resize them. Drag to move, drag a handle to resize,
        Delete removes them. Press Enter or double-click a text object to edit its text, and Escape to finish. Plus and
        minus zoom, 0 fits the window, arrow keys pan when nothing is selected, hold Space and drag to pan.
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
          {gridLines !== null && gridLines * zoom >= MIN_GRID_SPACING_PX && (
            <div
              className="grid"
              data-testid="grid"
              aria-hidden="true"
              style={{ width: width * zoom, height: height * zoom, backgroundSize: `${gridLines * zoom}px ${gridLines * zoom}px` }}
            />
          )}
          {guides.map((g) =>
            g.orientation === "vertical" ? (
              <div
                key={`v${g.position}`}
                data-testid="guide-v"
                aria-hidden="true"
                className="guide guide--v"
                style={{ left: g.position * zoom, top: g.from * zoom, height: (g.to - g.from) * zoom }}
              />
            ) : (
              <div
                key={`h${g.position}`}
                data-testid="guide-h"
                aria-hidden="true"
                className="guide guide--h"
                style={{ top: g.position * zoom, left: g.from * zoom, width: (g.to - g.from) * zoom }}
              />
            ),
          )}
          {slide.objects
            .filter((o) => o.visible && o.id !== editing?.id)
            .map((o) => (
              <div
                key={o.id}
                data-object-id={o.id}
                role="button"
                tabIndex={-1}
                aria-label={o.name}
                aria-pressed={idSet.has(o.id)}
                className={`hit${idSet.has(o.id) ? " hit--selected" : ""}${o.locked ? " hit--locked" : ""}${overflowing.has(o.id) ? " hit--overflow" : ""}`}
                style={{ left: o.x * zoom, top: o.y * zoom, width: o.width * zoom, height: o.height * zoom }}
              />
            ))}
          {selectedObjs.length > 1 && box && (
            <div
              className="selbox"
              data-testid="selection-box"
              aria-hidden="true"
              style={{ left: box.x * zoom, top: box.y * zoom, width: box.width * zoom, height: box.height * zoom }}
            />
          )}
          {box &&
            !editing &&
            !anyLocked &&
            HANDLE_IDS.map((h) => {
              const { fx, fy } = handleFraction(h);
              return (
                <div
                  key={h}
                  data-handle={h}
                  data-testid={`handle-${h}`}
                  aria-hidden="true"
                  className={`handle handle--${h}`}
                  style={{ left: (box.x + box.width * fx) * zoom, top: (box.y + box.height * fy) * zoom }}
                />
              );
            })}
          {marquee && (
            <div
              className="marquee"
              data-testid="marquee"
              aria-hidden="true"
              style={{ left: marquee.x * zoom, top: marquee.y * zoom, width: marquee.width * zoom, height: marquee.height * zoom }}
            />
          )}
          {editing && editing.type === "text" && (
            <TextEditor
              key={editing.id}
              object={editing}
              zoom={zoom}
              caretPoint={editCaret}
              onTextChange={(text) => onTextChange(editing.id, text)}
              onExit={onStopEditing}
              onToggleFormat={onToggleFormat}
              onAlign={onAlign}
              registerApi={registerEditorApi}
            />
          )}
        </div>
      </div>
    </div>
  );
}
