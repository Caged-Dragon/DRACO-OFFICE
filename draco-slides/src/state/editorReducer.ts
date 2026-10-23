import { createSlide, createTextBox, duplicateSlide, nextObjectName, nextSlideName } from "../core/document-model/factory";
import type { Presentation, Slide } from "../core/document-model/types";
import { constrainRect, isFiniteRect, rectsEqual, type Rect } from "../core/geometry/rect";

export interface EditorState {
  presentation: Presentation;
  currentSlideId: string;
  /** Object selected on the current slide. Cleared whenever another slide is selected. */
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
  | { type: "selectObject"; objectId: string | null }
  | { type: "setObjectRect"; objectId: string; rect: Rect }
  | { type: "deleteObject"; objectId: string }
  | { type: "startEditing"; objectId: string }
  | { type: "stopEditing" };

export function initEditorState(presentation: Presentation): EditorState {
  return { presentation, currentSlideId: presentation.slides[0].id, selectedObjectId: null, editingObjectId: null };
}

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

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { presentation } = state;
  switch (action.type) {
    case "addSlide": {
      const idx = presentation.slides.findIndex((s) => s.id === state.currentSlideId);
      const slide = createSlide(nextSlideName(presentation.slides));
      const slides = [...presentation.slides];
      slides.splice(idx + 1, 0, slide);
      return { presentation: touch({ ...presentation, slides }), currentSlideId: slide.id, selectedObjectId: null, editingObjectId: null };
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
        selectedObjectId: deletedCurrent ? null : state.selectedObjectId,
        editingObjectId: deletedCurrent ? null : state.editingObjectId,
      };
    }
    case "duplicateSlide": {
      const idx = presentation.slides.findIndex((s) => s.id === action.slideId);
      if (idx === -1) return state;
      const copy = duplicateSlide(presentation.slides[idx]);
      const slides = [...presentation.slides];
      slides.splice(idx + 1, 0, copy);
      return { presentation: touch({ ...presentation, slides }), currentSlideId: copy.id, selectedObjectId: null, editingObjectId: null };
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
      return { ...state, currentSlideId: action.slideId, selectedObjectId: null, editingObjectId: null };
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
      return next ? { presentation: next, currentSlideId: state.currentSlideId, selectedObjectId: box.id, editingObjectId: null } : state;
    }
    case "selectObject": {
      if (action.objectId === state.selectedObjectId) return state;
      if (action.objectId !== null) {
        const slide = presentation.slides.find((s) => s.id === state.currentSlideId);
        if (!slide?.objects.some((o) => o.id === action.objectId)) return state;
      }
      return {
        ...state,
        selectedObjectId: action.objectId,
        editingObjectId: state.editingObjectId === action.objectId ? state.editingObjectId : null,
      };
    }
    case "setObjectRect": {
      if (!isFiniteRect(action.rect)) return state;
      const next = withCurrentSlide(state, (slide) => {
        const obj = slide.objects.find((o) => o.id === action.objectId);
        if (!obj) return slide;
        const rect = constrainRect(action.rect, presentation);
        if (rectsEqual(rect, obj)) return slide;
        return { ...slide, objects: slide.objects.map((o) => (o === obj ? { ...o, ...rect } : o)) };
      });
      return next ? { ...state, presentation: next } : state;
    }
    case "deleteObject": {
      const next = withCurrentSlide(state, (slide) =>
        slide.objects.some((o) => o.id === action.objectId)
          ? { ...slide, objects: slide.objects.filter((o) => o.id !== action.objectId) }
          : slide,
      );
      if (!next) return state;
      return {
        ...state,
        presentation: next,
        selectedObjectId: state.selectedObjectId === action.objectId ? null : state.selectedObjectId,
        editingObjectId: state.editingObjectId === action.objectId ? null : state.editingObjectId,
      };
    }
    case "startEditing": {
      const slide = presentation.slides.find((s) => s.id === state.currentSlideId);
      const obj = slide?.objects.find((o) => o.id === action.objectId);
      if (!obj || !obj.visible || obj.type !== "text") return state;
      if (state.editingObjectId === obj.id && state.selectedObjectId === obj.id) return state;
      return { ...state, selectedObjectId: obj.id, editingObjectId: obj.id };
    }
    case "stopEditing":
      return state.editingObjectId === null ? state : { ...state, editingObjectId: null };
  }
}
