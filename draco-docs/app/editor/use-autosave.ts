"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

export type SaveStatus = "idle" | "saving" | "saved";

export type DocMeta = {
  title: string;
  header: string;
  footer: string;
  showPageNumber: boolean;
};

export const DEFAULT_DOC_META: DocMeta = {
  title: "",
  header: "",
  footer: "",
  showPageNumber: false,
};

export type Draft = DocMeta & {
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
    // Back-compat: v7 stored raw TipTap JSON with no metadata at all;
    // v8-v13 stored {title, content} with no header/footer/page-number.
    if (parsed && typeof parsed === "object" && "type" in parsed) {
      return { ...DEFAULT_DOC_META, content: parsed };
    }
    if (parsed && typeof parsed === "object" && "content" in parsed) {
      return { ...DEFAULT_DOC_META, ...parsed };
    }
    return null;
  } catch {
    // Corrupt or inaccessible storage shouldn't crash the editor.
    return null;
  }
}

function saveDraft(draft: Draft) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

/**
 * Debounced autosave, persisting {title, header, footer, showPageNumber,
 * content} together.
 *
 * `scheduleSave` is a plain callback (not tucked inside an effect body), so
 * it's safe to call both from an <input onChange> (a real event handler)
 * and from TipTap's own "update" event listener (also fires asynchronously,
 * never synchronously during the effect's own execution) — avoiding the
 * "setState synchronously in an effect" pitfall entirely.
 */
export function useAutosave(editor: Editor | null) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaRef = useRef<DocMeta>(DEFAULT_DOC_META);

  const scheduleSave = useCallback(
    (meta: DocMeta) => {
      if (!editor) return;
      metaRef.current = meta;
      setStatus("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          saveDraft({ ...metaRef.current, content: editor.getJSON() });
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
    const handleUpdate = () => scheduleSave(metaRef.current);
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, scheduleSave]);

  return { status, scheduleSave };
}
