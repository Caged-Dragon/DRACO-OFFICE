import type { PageSettings } from "./page-settings";
import { DEFAULT_PAGE_SETTINGS } from "./page-settings";

export const FILE_FORMAT_VERSION = 2;
export const FILE_EXTENSION = "dwdoc";
export const MIME_TYPE = "application/vnd.docwrite+json";

export type DocWriteFile = {
  formatVersion: number;
  title: string;
  header: string;
  footer: string;
  showPageNumber: boolean;
  content: Record<string, unknown>;
  pageSettings: PageSettings;
};

export type DocumentData = Omit<DocWriteFile, "formatVersion">;

export function serializeDocument(doc: DocumentData): string {
  const file: DocWriteFile = { formatVersion: FILE_FORMAT_VERSION, ...doc };
  return JSON.stringify(file, null, 2);
}

export class InvalidDocumentError extends Error {}

export function parseDocument(raw: string): DocWriteFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidDocumentError("That file isn't valid JSON.");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("content" in parsed) ||
    typeof (parsed as Record<string, unknown>).content !== "object"
  ) {
    throw new InvalidDocumentError(
      "That file doesn't look like a DocWrite document."
    );
  }
  const p = parsed as Partial<DocWriteFile>;
  return {
    formatVersion: p.formatVersion ?? 1,
    title: typeof p.title === "string" ? p.title : "",
    // v1 files (format version 1) predate header/footer/page numbers.
    header: typeof p.header === "string" ? p.header : "",
    footer: typeof p.footer === "string" ? p.footer : "",
    showPageNumber: typeof p.showPageNumber === "boolean" ? p.showPageNumber : false,
    content: p.content as Record<string, unknown>,
    pageSettings: { ...DEFAULT_PAGE_SETTINGS, ...p.pageSettings },
  };
}

export function suggestedFileName(title: string): string {
  const slug = title.trim() || "Untitled document";
  return `${slug}.${FILE_EXTENSION}`;
}
