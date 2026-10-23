import { useCallback, useState } from "react";
import { APP_VERSION } from "./app/version";
import { AppCrash } from "./components/common/AppCrash";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { AppShell } from "./components/layout/AppShell";
import { createPresentation } from "./core/document-model/factory";
import { MAX_FILE_BYTES, deserializePresentation, fileNameFor, serializePresentation } from "./core/serialization/serialize";
import { Editor } from "./features/editor/Editor";
import { EditorCrash } from "./features/editor/EditorCrash";
import { Home } from "./features/home/Home";
import { prepareImport } from "./services/import/importPresentation";
import { getPresentation, recordExists, savePresentation } from "./services/storage/presentationStore";
import { describeStorageError } from "./services/storage/storageError";
import { useGlobalErrorHandlers } from "./hooks/useGlobalErrorHandlers";
import { AppProvider, useApp } from "./state/AppContext";
import { SettingsProvider, useSettings } from "./state/SettingsContext";
import { downloadTextFile } from "./utils/download";
import { readFileAsText } from "./utils/readFile";

function Screens() {
  const { state, dispatch, notify } = useApp();
  const { settings } = useSettings();
  const [editorAttempt, setEditorAttempt] = useState(0);
  const openId = state.presentation?.id ?? null;
  useGlobalErrorHandlers(notify);

  /** After an editor crash: reload what autosave stored. */
  const reloadSaved = useCallback(async () => {
    try {
      const p = openId ? await getPresentation(openId) : null;
      if (!p) throw new Error("The saved version could not be read.");
      dispatch({ type: "openPresentation", presentation: p });
      setEditorAttempt((n) => n + 1);
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Could not restore the presentation.");
    }
  }, [openId, dispatch, notify]);

  const saveStoredCopy = useCallback(async () => {
    try {
      const p = openId ? await getPresentation(openId) : null;
      if (!p) throw new Error("The saved version could not be read.");
      downloadTextFile(fileNameFor(p.title), serializePresentation(p, APP_VERSION));
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Could not save a copy.");
    }
  }, [openId, notify]);

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
              presentation: createPresentation(title || undefined, {
                size,
                createdWith: APP_VERSION,
                author: settings.defaultAuthor,
              }),
            })
          }
          onOpen={openById}
          onImportFile={importFile}
        />
      )}
      {/* Kept mounted while hidden so edits and autosave survive a trip to Home. */}
      {state.presentation && (
        <div className="shell__editor" hidden={state.view !== "editor"}>
          <ErrorBoundary
            key={editorAttempt}
            fallback={() => (
              <EditorCrash
                onReload={reloadSaved}
                onSaveCopy={saveStoredCopy}
                onClose={() => dispatch({ type: "closePresentation" })}
              />
            )}
          >
            <Editor key={state.presentation.id} initial={state.presentation} />
          </ErrorBoundary>
        </div>
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallback={() => <AppCrash />}>
      <AppProvider>
        <SettingsProvider>
          <Screens />
        </SettingsProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
