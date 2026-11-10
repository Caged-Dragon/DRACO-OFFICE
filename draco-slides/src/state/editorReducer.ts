import { createShape, createSlide, createTextBox, duplicateSlide, newId, nextObjectName, nextSlideName } from "../core/document-model/factory";
import { sanitizeTextFormatPatch } from "../core/document-model/fonts";
import { applyBoxPatch, boxEqual, sanitizeBoxPatch, type BoxPatch } from "../core/document-model/box";
import { expandSelection, groupObjects, normalizeGroups, ungroupObjects } from "../core/document-model/groups";
import { MIN_LINE_LENGTH, SHAPE_INFO, SHAPE_KINDS, minSize } from "../core/document-model/shapes";
import { shiftLevels } from "../core/document-model/lists";
import { applyParagraphPatch, paragraphEqual, sanitizeParagraphPatch } from "../core/document-model/paragraph";
import type { ParagraphFormat, Presentation, ShapeKind, Slide, TextFormat } from "../core/document-model/types";
import { MAX_OBJECT_SIZE, MIN_OBJECT_SIZE, constrainRect, isFiniteRect, rectsEqual, type Rect } from "../core/geometry/rect";

export interface EditorState {
  presentation: Presentation;
  currentSlideId: string;
  /** Objects selected on the current slide, in stacking order. Cleared whenever another slide is selected. */
  selectedObjectIds: string[];
  /** The selected object when exactly one is selected, otherwise null. Single-object commands (text editing, formatting, position fields) use this. */
  selectedObjectId: string | null;
  /** Text object being edited in place (always the selected one). Cleared when the slide or selection changes. */
  editingObjectId: string | null;
}

export type EditorAction =
  | { type: "addSlide" }
  | { type: "deleteSlide"; slideId: string }
  | { type: "duplicateSlide"; slideId: string }
  | { type: "renameSlide"; slideId: string; name: string }
  | { type: "moveSlide"; slideId: string; toIndex: number }
  | { type: "selectSlide"; slideId: string }
  | { type: "renamePresentation"; title: string }
  | { type: "updateProperties"; title: string; author: string; description: string }
  | { type: "setObjectText"; slideId: string; objectId: string; text: string }
  | { type: "addTextBox" }
  | { type: "addShape"; shape: ShapeKind }
  | { type: "selectObject"; objectId: string | null }
  | { type: "selectObjects"; objectIds: string[]; /** Selecting a group member selects the whole group (default true). */ expand?: boolean }
  | { type: "toggleObjectSelection"; objectId: string }
  | { type: "selectAllObjects" }
  | { type: "setObjectRects"; rects: Record<string, Rect> }
  | { type: "deleteSelection" }
  | { type: "groupSelection" }
  | { type: "ungroupSelection" }
  | { type: "setObjectsLocked"; locked: boolean }
  | { type: "setObjectRect"; objectId: string; rect: Rect }
  | { type: "deleteObject"; objectId: string }
  | { type: "setTextFormat"; objectId: string; patch: Partial<Record<keyof TextFormat, unknown>> }
  | { type: "setParagraphFormat"; objectId: string; patch: Partial<Record<keyof ParagraphFormat, unknown>> }
  | { type: "setBoxFormat"; objectId: string; patch: BoxPatch }
  | { type: "shiftListLevel"; objectId: string; delta: number }
  | { type: "startEditing"; objectId: string }
  | { type: "stopEditing" };

/** The two selection fields that always change together. */
export const selection = (ids: string[]) => ({ selectedObjectIds: ids, selectedObjectId: ids.length === 1 ? ids[0] : null });

export function initEditorState(presentation: Presentation): EditorState {
  return { presentation, currentSlideId: presentation.slides[0].id, ...selection([]), editingObjectId: null };
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

function touch(p: Presentation): Presentation {
  return { ...p, updatedAt: new Date().toISOString() };
}

/** Applies `fn` to the current slide; returns the same state when the slide or `fn` result is unchanged. */
function withCurrentSlide(state: EditorState, fn: (slide: Slide) => Slide): Presentation | null {
  const { presentation, currentSlideId } = state;
  const slide = presentation.slides.find((s) => s.id === currentSlideId);
  if (!slide) return null;
  const next = fn(slide);
  if (next === slide) return null;
  return touch({ ...presentation, slides: presentation.slides.map((s) => (s === slide ? next : s)) });
}

/** Replaces the selection with `ids` (existing, visible objects of the current slide, in stacking order). */
function reduceSelection(state: EditorState, ids: string[], expand: boolean): EditorState {
  const slide = state.presentation.slides.find((sl) => sl.id === state.currentSlideId);
  if (!slide) return state;
  const wanted = new Set(ids);
  const known = slide.objects.filter((o) => o.visible && wanted.has(o.id)).map((o) => o.id);
  if (ids.length > 0 && known.length === 0) return state; // only unknown or hidden objects were asked for
  const next = expand ? expandSelection(slide.objects, known) : known;
  if (sameIds(next, state.selectedObjectIds)) return state;
  const stillEditing = next.length === 1 && state.editingObjectId === next[0] ? state.editingObjectId : null;
  return { ...state, ...selection(next), editingObjectId: stillEditing };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { presentation } = state;
  switch (action.type) {
    case "addSlide": {
      const idx = presentation.slides.findIndex((s) => s.id === state.currentSlideId);
      const slide = createSlide(nextSlideName(presentation.slides));
      const slides = [...presentation.slides];
      slides.splice(idx + 1, 0, slide);
      return { presentation: touch({ ...presentation, slides }), currentSlideId: slide.id, ...selection([]), editingObjectId: null };
    }
    case "deleteSlide": {
      if (presentation.slides.length <= 1) return state;
      const idx = presentation.slides.findIndex((s) => s.id === action.slideId);
      if (idx === -1) return state;
      const slides = presentation.slides.filter((s) => s.id !== action.slideId);
      const deletedCurrent = state.currentSlideId === action.slideId;
      return {
        presentation: touch({ ...presentation, slides }),
        currentSlideId: deletedCurrent ? slides[Math.min(idx, slides.length - 1)].id : state.currentSlideId,
        ...(deletedCurrent ? selection([]) : { selectedObjectIds: state.selectedObjectIds, selectedObjectId: state.selectedObjectId }),
        editingObjectId: deletedCurrent ? null : state.editingObjectId,
      };
    }
    case "duplicateSlide": {
      const idx = presentation.slides.findIndex((s) => s.id === action.slideId);
      if (idx === -1) return state;
      const copy = duplicateSlide(presentation.slides[idx]);
      const slides = [...presentation.slides];
      slides.splice(idx + 1, 0, copy);
      return { presentation: touch({ ...presentation, slides }), currentSlideId: copy.id, ...selection([]), editingObjectId: null };
    }
    case "renameSlide": {
      const name = action.name.trim().slice(0, 100);
      if (!name || !presentation.slides.some((s) => s.id === action.slideId)) return state;
      return {
        ...state,
        presentation: touch({
          ...presentation,
          slides: presentation.slides.map((s) => (s.id === action.slideId ? { ...s, name } : s)),
        }),
      };
    }
    case "moveSlide": {
      const from = presentation.slides.findIndex((s) => s.id === action.slideId);
      if (from === -1) return state;
      const to = Math.max(0, Math.min(presentation.slides.length - 1, action.toIndex));
      if (from === to) return state;
      const slides = [...presentation.slides];
      const [moved] = slides.splice(from, 1);
      slides.splice(to, 0, moved);
      return { ...state, presentation: touch({ ...presentation, slides }) }; // selection follows the slide id
    }
    case "selectSlide": {
      if (!presentation.slides.some((s) => s.id === action.slideId)) return state;
      if (action.slideId === state.currentSlideId) return state;
      return { ...state, currentSlideId: action.slideId, ...selection([]), editingObjectId: null };
    }
    case "renamePresentation":
      return { ...state, presentation: touch({ ...presentation, title: action.title.trim() || "Untitled presentation" }) };
    case "updateProperties":
      return {
        ...state,
        presentation: touch({
          ...presentation,
          title: action.title.trim().slice(0, 200) || "Untitled presentation",
          metadata: {
            ...presentation.metadata,
            author: action.author.trim().slice(0, 200),
            description: action.description.trim().slice(0, 2000),
          },
        }),
      };
    case "setObjectText":
      return {
        ...state,
        presentation: touch({
          ...presentation,
          slides: presentation.slides.map((s) =>
            s.id !== action.slideId
              ? s
              : { ...s, objects: s.objects.map((o) => (o.id === action.objectId ? { ...o, text: action.text } : o)) },
          ),
        }),
      };
    case "addTextBox": {
      const slide = presentation.slides.find((s) => s.id === state.currentSlideId);
      if (!slide) return state;
      const width = 300;
      const height = 80;
      let x = (presentation.width - width) / 2;
      let y = (presentation.height - height) / 2;
      // Cascade so a new box never sits exactly on top of an existing one.
      for (let i = 0; i < 20 && slide.objects.some((o) => o.x === x && o.y === y); i++) {
        x += 24;
        y += 24;
      }
      const box = createTextBox(
        nextObjectName(slide.objects, "Text box"),
        constrainRect({ x, y, width, height }, presentation),
      );
      const next = withCurrentSlide(state, (s) => ({ ...s, objects: [...s.objects, box] }));
      return next ? { presentation: next, currentSlideId: state.currentSlideId, ...selection([box.id]), editingObjectId: null } : state;
    }
    case "addShape": {
      const slide = presentation.slides.find((s) => s.id === state.currentSlideId);
      if (!slide || !SHAPE_KINDS.includes(action.shape)) return state;
      const info = SHAPE_INFO[action.shape];
      let x = (presentation.width - info.width) / 2;
      let y = (presentation.height - info.height) / 2;
      // Cascade so a new shape never sits exactly on top of an existing one.
      for (let i = 0; i < 20 && slide.objects.some((o) => o.x === x && o.y === y); i++) {
        x += 24;
        y += 24;
      }
      const shape = createShape(
        action.shape,
        nextObjectName(slide.objects, info.label),
        constrainRect({ x, y, width: info.width, height: info.height }, presentation, minSize({ shape: action.shape })),
      );
      const next = withCurrentSlide(state, (s) => ({ ...s, objects: [...s.objects, shape] }));
      return next ? { presentation: next, currentSlideId: state.currentSlideId, ...selection([shape.id]), editingObjectId: null } : state;
    }
    case "selectObject":
      return reduceSelection(state, action.objectId === null ? [] : [action.objectId], true);
    case "selectObjects":
      return reduceSelection(state, action.objectIds, action.expand !== false);
    case "toggleObjectSelection": {
      const slide = presentation.slides.find((sl) => sl.id === state.currentSlideId);
      if (!slide) return state;
      const members = expandSelection(slide.objects, [action.objectId]);
      if (members.length === 0) return state;
      const current = new Set(state.selectedObjectIds);
      if (members.every((id) => current.has(id))) members.forEach((id) => current.delete(id));
      else members.forEach((id) => current.add(id));
      return reduceSelection(state, [...current], false);
    }
    case "selectAllObjects": {
      const slide = presentation.slides.find((sl) => sl.id === state.currentSlideId);
      return slide ? reduceSelection(state, slide.objects.filter((o) => o.visible).map((o) => o.id), false) : state;
    }
    case "setObjectRect": {
      if (!isFiniteRect(action.rect)) return state;
      const next = withCurrentSlide(state, (slide) => {
        const obj = slide.objects.find((o) => o.id === action.objectId);
        if (!obj || obj.locked) return slide;
        const rect = constrainRect(action.rect, presentation, minSize(obj));
        if (obj.shape === "line" && Math.hypot(rect.width, rect.height) < MIN_LINE_LENGTH) return slide; // never shrink a line to nothing
        if (rectsEqual(rect, obj)) return slide;
        return { ...slide, objects: slide.objects.map((o) => (o === obj ? { ...o, ...rect } : o)) };
      });
      return next ? { ...state, presentation: next } : state;
    }
    case "setObjectRects": {
      const slide = presentation.slides.find((sl) => sl.id === state.currentSlideId);
      const entries = Object.entries(action.rects);
      if (!slide || entries.length === 0) return state;
      // Several objects move or scale together, so the rectangles are applied as given (no per-object clamping).
      for (const [id, r] of entries) {
        const obj = slide.objects.find((o) => o.id === id);
        if (!obj || !obj.visible || obj.locked || !isFiniteRect(r)) return state;
        const min = minSize(obj);
        if (obj.shape === "line" && Math.hypot(r.width, r.height) < MIN_LINE_LENGTH) return state;
        if (r.width < min.width - 1e-6 || r.height < min.height - 1e-6 || r.width > MAX_OBJECT_SIZE || r.height > MAX_OBJECT_SIZE) return state;
        if (Math.abs(r.x) > 1e5 || Math.abs(r.y) > 1e5) return state;
      }
      const round = (v: number) => Math.round(v * 100) / 100;
      const next = withCurrentSlide(state, (sl) => {
        let changed = false;
        const objects = sl.objects.map((o) => {
          const r = action.rects[o.id];
          if (!r) return o;
          const rect = { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height) };
          if (rectsEqual(rect, o)) return o;
          changed = true;
          return { ...o, ...rect };
        });
        return changed ? { ...sl, objects } : sl;
      });
      return next ? { ...state, presentation: next } : state;
    }
    case "deleteObject": {
      const slide = presentation.slides.find((sl) => sl.id === state.currentSlideId);
      const target = slide?.objects.find((o) => o.id === action.objectId);
      if (!target || target.locked) return state;
      const next = withCurrentSlide(state, (sl) => ({ ...sl, objects: normalizeGroups(sl.objects.filter((o) => o.id !== action.objectId)) }));
      if (!next) return state;
      const ids = state.selectedObjectIds.filter((id) => id !== action.objectId);
      return {
        ...state,
        presentation: next,
        ...selection(ids),
        editingObjectId: state.editingObjectId === action.objectId ? null : state.editingObjectId,
      };
    }
    case "deleteSelection": {
      const slide = presentation.slides.find((sl) => sl.id === state.currentSlideId);
      if (!slide || state.selectedObjectIds.length === 0) return state;
      const doomed = new Set(state.selectedObjectIds);
      const victims = slide.objects.filter((o) => doomed.has(o.id));
      if (victims.length === 0 || victims.some((o) => o.locked)) return state;
      const next = withCurrentSlide(state, (sl) => ({ ...sl, objects: normalizeGroups(sl.objects.filter((o) => !doomed.has(o.id))) }));
      return next ? { ...state, presentation: next, ...selection([]), editingObjectId: null } : state;
    }
    case "groupSelection": {
      const grouped = presentation.slides.find((sl) => sl.id === state.currentSlideId);
      if (!grouped) return state;
      const objects = groupObjects(grouped.objects, state.selectedObjectIds, newId());
      if (!objects) return state;
      const next = withCurrentSlide(state, (sl) => ({ ...sl, objects }));
      return next ? { ...state, presentation: next, editingObjectId: null } : state;
    }
    case "ungroupSelection": {
      const slide = presentation.slides.find((sl) => sl.id === state.currentSlideId);
      if (!slide) return state;
      const objects = ungroupObjects(slide.objects, state.selectedObjectIds);
      if (objects === slide.objects) return state;
      const next = withCurrentSlide(state, (sl) => ({ ...sl, objects }));
      return next ? { ...state, presentation: next } : state;
    }
    case "setObjectsLocked": {
      const chosen = new Set(state.selectedObjectIds);
      const next = withCurrentSlide(state, (sl) => {
        let changed = false;
        const objects = sl.objects.map((o) => {
          if (!chosen.has(o.id) || o.locked === action.locked) return o;
          changed = true;
          return { ...o, locked: action.locked };
        });
        return changed ? { ...sl, objects } : sl;
      });
      return next ? { ...state, presentation: next } : state;
    }
    case "setTextFormat": {
      const patch = sanitizeTextFormatPatch(action.patch);
      const entries = Object.entries(patch);
      if (entries.length === 0) return state;
      const next = withCurrentSlide(state, (slide) => {
        const obj = slide.objects.find((o) => o.id === action.objectId);
        if (!obj || !entries.some(([k, v]) => obj[k as keyof TextFormat] !== v)) return slide;
        return { ...slide, objects: slide.objects.map((o) => (o === obj ? { ...o, ...patch } : o)) };
      });
      return next ? { ...state, presentation: next } : state;
    }
    case "setParagraphFormat": {
      const patch = sanitizeParagraphPatch(action.patch);
      if (Object.keys(patch).length === 0) return state;
      const next = withCurrentSlide(state, (slide) => {
        const obj = slide.objects.find((o) => o.id === action.objectId);
        if (!obj) return slide;
        const result = applyParagraphPatch(obj, patch);
        if (paragraphEqual(obj, result)) return slide;
        return { ...slide, objects: slide.objects.map((o) => (o === obj ? { ...o, ...result } : o)) };
      });
      return next ? { ...state, presentation: next } : state;
    }
    case "setBoxFormat": {
      const patch = sanitizeBoxPatch(action.patch);
      if (Object.keys(patch).length === 0) return state;
      const next = withCurrentSlide(state, (slide) => {
        const obj = slide.objects.find((o) => o.id === action.objectId);
        if (!obj) return slide;
        const result = applyBoxPatch(obj, patch);
        if (boxEqual(obj, result)) return slide;
        return { ...slide, objects: slide.objects.map((o) => (o === obj ? { ...o, ...result } : o)) };
      });
      return next ? { ...state, presentation: next } : state;
    }
    case "shiftListLevel": {
      const next = withCurrentSlide(state, (slide) => {
        const obj = slide.objects.find((o) => o.id === action.objectId);
        if (!obj || obj.list === "none") return slide;
        const text = shiftLevels(obj.text, Math.sign(action.delta));
        return text === obj.text ? slide : { ...slide, objects: slide.objects.map((o) => (o === obj ? { ...o, text } : o)) };
      });
      return next ? { ...state, presentation: next } : state;
    }
    case "startEditing": {
      const slide = presentation.slides.find((s) => s.id === state.currentSlideId);
      const obj = slide?.objects.find((o) => o.id === action.objectId);
      if (!obj || !obj.visible || obj.type !== "text" || obj.shape === "line") return state; // lines carry no text
      if (state.editingObjectId === obj.id && state.selectedObjectId === obj.id) return state;
      return { ...state, ...selection([obj.id]), editingObjectId: obj.id };
    }
    case "stopEditing":
      return state.editingObjectId === null ? state : { ...state, editingObjectId: null };
  }
}
