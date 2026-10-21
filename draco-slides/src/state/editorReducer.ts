import { createSlide } from "../core/document-model/factory";
import type { Presentation } from "../core/document-model/types";

export interface EditorState {
  presentation: Presentation;
  currentSlideId: string;
}

export type EditorAction =
  | { type: "addSlide" }
  | { type: "deleteSlide"; slideId: string }
  | { type: "selectSlide"; slideId: string }
  | { type: "renamePresentation"; title: string }
  | { type: "setObjectText"; slideId: string; objectId: string; text: string };

export function initEditorState(presentation: Presentation): EditorState {
  return { presentation, currentSlideId: presentation.slides[0].id };
}

function touch(p: Presentation): Presentation {
  return { ...p, updatedAt: new Date().toISOString() };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { presentation } = state;
  switch (action.type) {
    case "addSlide": {
      const idx = presentation.slides.findIndex((s) => s.id === state.currentSlideId);
      const slide = createSlide(`Slide ${presentation.slides.length + 1}`);
      const slides = [...presentation.slides];
      slides.splice(idx + 1, 0, slide);
      return { presentation: touch({ ...presentation, slides }), currentSlideId: slide.id };
    }
    case "deleteSlide": {
      if (presentation.slides.length <= 1) return state;
      const idx = presentation.slides.findIndex((s) => s.id === action.slideId);
      if (idx === -1) return state;
      const slides = presentation.slides.filter((s) => s.id !== action.slideId);
      const currentSlideId =
        state.currentSlideId === action.slideId ? slides[Math.min(idx, slides.length - 1)].id : state.currentSlideId;
      return { presentation: touch({ ...presentation, slides }), currentSlideId };
    }
    case "selectSlide":
      return presentation.slides.some((s) => s.id === action.slideId)
        ? { ...state, currentSlideId: action.slideId }
        : state;
    case "renamePresentation":
      return { ...state, presentation: touch({ ...presentation, title: action.title.trim() || "Untitled presentation" }) };
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
  }
}
