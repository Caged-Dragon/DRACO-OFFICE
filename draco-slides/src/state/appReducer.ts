import type { Presentation } from "../core/document-model/types";

export type View = "home" | "editor";

export interface Notice {
  id: string;
  kind: "info" | "error";
  message: string;
}

export interface AppState {
  view: View;
  /** The presentation currently open in the editor, if any. */
  presentation: Presentation | null;
  notices: Notice[];
}

export type AppAction =
  | { type: "openPresentation"; presentation: Presentation }
  | { type: "closePresentation" }
  | { type: "navigate"; view: View }
  | { type: "notify"; notice: Notice }
  | { type: "dismissNotice"; id: string };

export const initialAppState: AppState = { view: "home", presentation: null, notices: [] };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "openPresentation":
      return { ...state, presentation: action.presentation, view: "editor" };
    case "closePresentation":
      return { ...state, presentation: null, view: "home" };
    case "navigate":
      // The editor view only exists while a presentation is open.
      if (action.view === "editor" && !state.presentation) return state;
      return { ...state, view: action.view };
    case "notify":
      return { ...state, notices: [...state.notices, action.notice] };
    case "dismissNotice":
      return { ...state, notices: state.notices.filter((n) => n.id !== action.id) };
  }
}
