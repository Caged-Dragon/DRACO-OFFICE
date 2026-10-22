import { useCallback } from "react";
import { APP_VERSION } from "./app/version";
import { AppShell } from "./components/layout/AppShell";
import { createPresentation } from "./core/document-model/factory";
import { MAX_FILE_BYTES, deserializePresentation } from "./core/serialization/serialize";
import { Editor } from "./features/editor/Editor";
import { Home } from "./features/home/Home";
import { prepareImport } from "./services/import/importPresentation";
import { getPresentation, recordExists, savePresentation } from "./services/storage/presentationStore";
import { describeStorageError } from "./services/storage/storageError";
import { AppProvider, useApp } from "./state/AppContext";
import { readFileAsText } from "./utils/readFile";

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

  const importFile = useCallback(
    async (file: File) => {
      try {
        if (file.size > MAX_FILE_BYTES) throw new Error("This file is too large to be a presentation.");
        const parsed = deserializePresentation(await readFileAsText(file));
        if (!parsed.ok) throw new Error(parsed.error);
        const p = prepareImport(parsed.presentation, await recordExists(parsed.presentation.id));
        try {
          await savePresentation(p);
        } catch (e) {
          throw new Error(`The file is fine, but it could not be stored: ${describeStorageError(e)}`);
        }
        dispatch({ type: "openPresentation", presentation: p });
        notify("info", `Opened "${p.title}" from ${file.name}.`);
      } catch (e) {
        notify("error", e instanceof Error ? e.message : "Could not open that file.");
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
          onImportFile={importFile}
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
