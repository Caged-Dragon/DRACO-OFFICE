import { DOCUMENT_SCHEMA_VERSION, type Presentation } from "../document-model/types";
import { parsePresentation } from "./migrate";
import { sanitizePresentation } from "./sanitize";

/**
 * Preliminary native file format ("Draco Slides JSON"). A JSON envelope around the presentation.
 * The final native format is planned for roadmap Version 63; files written now stay readable.
 */
export const FILE_FORMAT = "draco-slides";
export const FILE_FORMAT_VERSION = 1;
export const FILE_EXTENSION = ".draco-slides.json";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function serializePresentation(p: Presentation, savedWith: string, now: Date = new Date()): string {
  return JSON.stringify(
    {
      format: FILE_FORMAT,
      formatVersion: FILE_FORMAT_VERSION,
      savedWith,
      savedAt: now.toISOString(),
      presentation: p,
    },
    null,
    2,
  );
}

export type DeserializeResult = { ok: true; presentation: Presentation } | { ok: false; error: string };
const fail = (error: string): DeserializeResult => ({ ok: false, error });

/** Reads a Draco Slides file. Never throws; returns a message that is safe to show to the user. */
export function deserializePresentation(text: string): DeserializeResult {
  if (text.length > MAX_FILE_BYTES) return fail("This file is too large to be a presentation.");

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail("This file is not valid JSON, so it is not a Draco Slides presentation.");
  }
  if (!isRecord(data) || data.format !== FILE_FORMAT) return fail("This is not a Draco Slides file.");

  const newer = "This file was saved by a newer version of Draco Slides. Update the app to open it.";
  if (typeof data.formatVersion === "number" && data.formatVersion > FILE_FORMAT_VERSION) return fail(newer);
  const inner = data.presentation;
  if (isRecord(inner) && typeof inner.schemaVersion === "number" && inner.schemaVersion > DOCUMENT_SCHEMA_VERSION) {
    return fail(newer);
  }

  const parsed = parsePresentation(inner);
  if (!parsed.ok) {
    return fail(`This presentation file is damaged or invalid: ${parsed.errors.slice(0, 3).join("; ")}`);
  }
  return { ok: true, presentation: sanitizePresentation(parsed.value) };
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/** Safe download file name for a presentation title. */
export function fileNameFor(title: string): string {
  let base = title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80)
    .trim();
  if (!base) base = "presentation";
  if (RESERVED.test(base)) base = `_${base}`;
  return `${base}${FILE_EXTENSION}`;
}
