import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import { appReducer, initialAppState, type AppAction, type AppState, type Notice } from "./appReducer";

interface AppContextValue {
  state: AppState;
  dispatch: (action: AppAction) => void;
  notify: (kind: Notice["kind"], message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const notify = useCallback(
    (kind: Notice["kind"], message: string) =>
      dispatch({ type: "notify", notice: { id: crypto.randomUUID(), kind, message } }),
    [],
  );
  const value = useMemo(() => ({ state, dispatch, notify }), [state, notify]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
