"use client";

import {
  serializeDocument,
  parseDocument,
  suggestedFileName,
  FILE_EXTENSION,
  MIME_TYPE,
  type DocumentData,
  type DocWriteFile,
} from "./file-format";

export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

const PICKER_TYPES = [
  {
    description: "DocWrite Document",
    accept: { [MIME_TYPE]: [`.${FILE_EXTENSION}`] },
  },
];

/** User cancelled a native file picker — not an error worth surfacing. */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export async function saveDocumentToDisk(doc: DocumentData): Promise<boolean> {
  const json = serializeDocument(doc);

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggestedFileName(doc.title),
        types: PICKER_TYPES,
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return true;
    } catch (err) {
      if (isAbortError(err)) return false;
      throw err;
    }
  }

  // Fallback for browsers without the File System Access API (Firefox,
  // Safari as of this writing): trigger a plain download.
  const blob = new Blob([json], { type: MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedFileName(doc.title);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export async function openDocumentFromDisk(): Promise<DocWriteFile | null> {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: PICKER_TYPES,
        multiple: false,
      });
      const file = await handle.getFile();
      return parseDocument(await file.text());
    } catch (err) {
      if (isAbortError(err)) return null;
      throw err;
    }
  }

  // Fallback: a hidden <input type="file">.
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `.${FILE_EXTENSION}`;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        resolve(parseDocument(await file.text()));
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}
