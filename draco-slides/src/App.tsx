import { useCallback } from "react";
import { APP_VERSION } from "./app/version";
import { AppShell } from "./components/layout/AppShell";
import { createPresentation } from "./core/document-model/factory";
import { Editor } from "./features/editor/Editor";
import { Home } from "./features/home/Home";
import { getPresentation } from "./services/storage/presentationStore";
import { AppProvider, useApp } from "./state/AppContext";

function Screens() {
  const { state, dispatch, notify } = useApp();

  const openById = useCallback(
    async (id: string) => {
      try {
        const p = await getPresentation(id);
        if (!p) throw new Error("That presentation is missing or unreadable.");
        dispatch({ type: "openPresentation", presentation: p });
      } catch (e) {
        notify("error", e instanceof Error ? e.message : "Could not open the presentation.");
      }
    },
    [dispatch, notify],
  );

  return (
    <AppShell>
      {state.view === "home" && (
        <Home
          onNew={(title, size) =>
            dispatch({
              type: "openPresentation",
              presentation: createPresentation(title || undefined, { size, createdWith: APP_VERSION }),
            })
          }
          onOpen={openById}
        />
      )}
      {/* Kept mounted while hidden so edits and autosave survive a trip to Home. */}
      {state.presentation && (
        <div className="shell__editor" hidden={state.view !== "editor"}>
          <Editor key={state.presentation.id} initial={state.presentation} />
        </div>
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Screens />
    </AppProvider>
  );
}
