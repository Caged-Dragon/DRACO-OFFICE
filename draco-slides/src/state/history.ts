import type { Presentation } from "../core/document-model/types";
import { editorReducer, initEditorState, selection, type EditorAction, type EditorState } from "./editorReducer";

/** How many undo steps are kept. Older ones are dropped. */
export const HISTORY_LIMIT = 100;

/**
 * What the editor looked like before a change: the document plus where the user was (slide and selection), so
 * undoing also brings back the context. The presentation is immutable, so snapshots share almost all of their data.
 */
export interface Snapshot {
  presentation: Presentation;
  currentSlideId: string;
  selectedObjectIds: string[];
  /** Human-readable name of the change this snapshot undoes or redoes ("Move or resize"). */
  label: string;
}

export interface HistoryState {
  present: EditorState;
  past: Snapshot[];
  future: Snapshot[];
  /** Key of the run of changes being merged into one undo step, or null. */
  coalesceKey: string | null;
}

export type HistoryAction = EditorAction | { type: "undo" } | { type: "redo" } | { type: "breakHistory" };

export function initHistoryState(presentation: Presentation): HistoryState {
  return { present: initEditorState(presentation), past: [], future: [], coalesceKey: null };
}

/** Name shown in the Undo/Redo tooltips and announcements. */
export function describeAction(action: EditorAction): string {
  switch (action.type) {
    case "addSlide":
      return "New slide";
    case "deleteSlide":
      return "Delete slide";
    case "duplicateSlide":
      return "Duplicate slide";
    case "renameSlide":
      return "Rename slide";
    case "moveSlide":
      return "Move slide";
    case "renamePresentation":
    case "updateProperties":
      return "Presentation properties";
    case "setObjectText":
      return "Typing";
    case "addTextBox":
      return "Insert text box";
    case "setObjectRect":
    case "setObjectRects":
      return "Move or resize";
    case "deleteObject":
    case "deleteSelection":
      return "Delete";
    case "setTextFormat":
      return "Format text";
    case "setParagraphFormat":
    case "shiftListLevel":
      return "Format paragraph";
    case "setBoxFormat":
      return "Text box layout";
    case "groupSelection":
      return "Group";
    case "ungroupSelection":
      return "Ungroup";
    case "setObjectsLocked":
      return action.locked ? "Lock" : "Unlock";
    default:
      return "Edit";
  }
}

/**
 * Changes of the same kind to the same object that arrive as a continuous stream (dragging, nudging, typing, a color
 * picker) share a key and become one undo step. Everything else returns null: one action, one step.
 */
export function coalesceKeyFor(action: EditorAction): string | null {
  switch (action.type) {
    case "setObjectRect":
      return `rect:${action.objectId}`;
    case "setObjectRects":
      return `rect:${Object.keys(action.rects).sort().join(",")}`;
    case "setObjectText":
      return `text:${action.objectId}`;
    case "renamePresentation":
      return "title";
    case "setTextFormat": {
      const keys = Object.keys(action.patch);
      return keys.length === 1 && keys[0] === "color" ? `color:${action.objectId}` : null;
    }
    default:
      return null;
  }
}

const snapshotOf = (s: EditorState, label: string): Snapshot => ({
  presentation: s.presentation,
  currentSlideId: s.currentSlideId,
  selectedObjectIds: s.selectedObjectIds,
  label,
});

/** The editor state a snapshot describes. Selection is limited to objects that still exist; editing always ends. */
function restore(snap: Snapshot): EditorState {
  const presentation = { ...snap.presentation, updatedAt: new Date().toISOString() };
  const slide = presentation.slides.find((s) => s.id === snap.currentSlideId) ?? presentation.slides[0];
  const visible = new Set(slide.objects.filter((o) => o.visible).map((o) => o.id));
  return {
    presentation,
    currentSlideId: slide.id,
    ...selection(snap.selectedObjectIds.filter((id) => visible.has(id))),
    editingObjectId: null,
  };
}

/**
 * Wraps the editor reducer with undo and redo. Only actions that change the document are recorded; selection, slide
 * navigation and editing state are not. Any other action ends a run of merged changes, so two separate typing
 * sessions or two separate drags are two steps even if nothing else happened in between.
 */
export function historyReducer(h: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "undo": {
      const snap = h.past[h.past.length - 1];
      if (!snap) return h;
      return { present: restore(snap), past: h.past.slice(0, -1), future: [...h.future, snapshotOf(h.present, snap.label)], coalesceKey: null };
    }
    case "redo": {
      const snap = h.future[h.future.length - 1];
      if (!snap) return h;
      return { present: restore(snap), past: [...h.past, snapshotOf(h.present, snap.label)].slice(-HISTORY_LIMIT), future: h.future.slice(0, -1), coalesceKey: null };
    }
    case "breakHistory":
      return h.coalesceKey === null ? h : { ...h, coalesceKey: null };
    default: {
      const next = editorReducer(h.present, action);
      if (next === h.present) return h;
      if (next.presentation === h.present.presentation) return { ...h, present: next, coalesceKey: null };
      const key = coalesceKeyFor(action);
      const merge = key !== null && key === h.coalesceKey;
      const past = merge ? h.past : [...h.past, snapshotOf(h.present, describeAction(action))].slice(-HISTORY_LIMIT);
      return { present: next, past, future: [], coalesceKey: key };
    }
  }
}
