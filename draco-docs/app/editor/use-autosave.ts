"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

export type SaveStatus = "idle" | "saving" | "saved";

export type Draft = {
  title: string;
  content: Record<string, unknown>;
};

const DRAFT_KEY = "docwrite:draft";
const DEBOUNCE_MS = 800;

export function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Back-compat: v7 stored the raw TipTap JSON directly, with no title.
    if (parsed && typeof parsed === "object" && "type" in parsed) {
      return { title: "", content: parsed };
    }
    return parsed;
  } catch {
    // Corrupt or inaccessible storage shouldn't crash the editor.
    return null;
  }
}

function saveDraft(draft: Draft) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

/**
 * Debounced autosave, persisting {title, content} together.
 *
 * `scheduleSave` is a plain callback (not tucked inside an effect body), so
 * it's safe to call both from the title <input>'s onChange (a real event
 * handler) and from TipTap's own "update" event listener (also fires
 * asynchronously, never synchronously during the effect's own execution) —
 * avoiding the "setState synchronously in an effect" pitfall entirely.
 */
export function useAutosave(editor: Editor | null) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef("");

  const scheduleSave = useCallback(
    (title: string) => {
      if (!editor) return;
      titleRef.current = title;
      setStatus("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          saveDraft({ title: titleRef.current, content: editor.getJSON() });
          setStatus("saved");
        } catch {
          // Storage full or unavailable — fail silently, keep editing.
        }
      }, DEBOUNCE_MS);
    },
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => scheduleSave(titleRef.current);
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, scheduleSave]);

  return { status, scheduleSave };
}
