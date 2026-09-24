"use client";

import { useState } from "react";
import type { DocumentData, DocWriteFile } from "./file-format";
import { saveDocumentToDisk, openDocumentFromDisk } from "./local-file-io";

export default function FileControls({
  getDocument,
  onOpen,
}: {
  getDocument: () => DocumentData;
  onOpen: (file: DocWriteFile) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"saving" | "opening" | null>(null);

  const handleSave = async () => {
    setError(null);
    setBusy("saving");
    try {
      await saveDocumentToDisk(getDocument());
    } catch {
      setError("Couldn't save the file. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleOpen = async () => {
    setError(null);
    setBusy("opening");
    try {
      const file = await openDocumentFromDisk();
      if (file) onOpen(file);
    } catch {
      setError("Couldn't open that file — it may not be a DocWrite document.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSave}
        disabled={busy !== null}
        className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50 transition-colors"
      >
        {busy === "saving" ? "Saving…" : "Save to disk"}
      </button>
      <button
        type="button"
        onClick={handleOpen}
        disabled={busy !== null}
        className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50 transition-colors"
      >
        {busy === "opening" ? "Opening…" : "Open…"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
