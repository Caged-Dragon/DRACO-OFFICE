"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

export type SaveStatus = "idle" | "saving" | "saved";

const DRAFT_KEY = "docwrite:draft";
const DEBOUNCE_MS = 800;

export function loadDraft(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Corrupt or inaccessible storage shouldn't crash the editor.
    return null;
  }
}

export function useAutosave(editor: Editor | null) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedDraft = useRef(false);

  // Load any saved draft into the editor once, on mount.
  useEffect(() => {
    if (!editor || hasLoadedDraft.current) return;
    hasLoadedDraft.current = true;
    const draft = loadDraft();
    if (draft) {
      editor.commands.setContent(draft, { emitUpdate: false });
    }
  }, [editor]);

  // Debounced save on every content change.
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      setStatus("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          window.localStorage.setItem(
            DRAFT_KEY,
            JSON.stringify(editor.getJSON())
          );
          setStatus("saved");
        } catch {
          // Storage full or unavailable — fail silently, don't lose the
          // in-editor content, just skip the persisted draft this time.
        }
      }, DEBOUNCE_MS);
    };

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor]);

  return status;
}
