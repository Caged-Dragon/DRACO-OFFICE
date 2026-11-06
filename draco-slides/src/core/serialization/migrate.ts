import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_COLOR } from "../document-model/fonts";
import { defaultBoxFormat } from "../document-model/box";
import { defaultParagraphFormat } from "../document-model/paragraph";
import { validatePresentation, type ValidationResult } from "../validation/validatePresentation";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** v1 (releases 0.1.0 to 0.4.0) -> v2: adds metadata and object name/rotation/visible. Pure: never mutates `raw`. */
function migrateV1(raw: Record<string, unknown>): Record<string, unknown> {
  const slides = Array.isArray(raw.slides)
    ? raw.slides.map((s) =>
        isRecord(s) && Array.isArray(s.objects)
          ? {
              ...s,
              objects: s.objects.map((o) =>
                isRecord(o)
                  ? {
                      ...o,
                      name: typeof o.name === "string" ? o.name : o.role === "title" ? "Title" : "Body",
                      rotation: typeof o.rotation === "number" ? o.rotation : 0,
                      visible: typeof o.visible === "boolean" ? o.visible : true,
                    }
                  : o,
              ),
            }
          : s,
      )
    : raw.slides;
  return {
    ...raw,
    schemaVersion: 2,
    slides,
    metadata: { author: "", description: "", language: "en", createdWith: "before 0.5.0" },
  };
}

/** v2 -> v3: text objects may now have the "textbox" role. Existing data is unchanged. */
function migrateV2(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, schemaVersion: 3 };
}

/** v3 -> v4: text formatting fields. Titles become bold, as they were rendered before; existing sizes are kept. */
function migrateV3(raw: Record<string, unknown>): Record<string, unknown> {
  const slides = Array.isArray(raw.slides)
    ? raw.slides.map((s) =>
        isRecord(s) && Array.isArray(s.objects)
          ? {
              ...s,
              objects: s.objects.map((o) =>
                isRecord(o)
                  ? {
                      ...o,
                      fontFamily: typeof o.fontFamily === "string" ? o.fontFamily : DEFAULT_FONT_FAMILY,
                      bold: typeof o.bold === "boolean" ? o.bold : o.role === "title",
                      italic: typeof o.italic === "boolean" ? o.italic : false,
                      underline: typeof o.underline === "boolean" ? o.underline : false,
                      strike: typeof o.strike === "boolean" ? o.strike : false,
                      color: typeof o.color === "string" ? o.color : DEFAULT_TEXT_COLOR,
                    }
                  : o,
              ),
            }
          : s,
      )
    : raw.slides;
  return { ...raw, schemaVersion: 4, slides };
}

/** v4 -> v5: paragraph settings (alignment, indent, line spacing, direction) with the defaults text already had. */
function migrateV4(raw: Record<string, unknown>): Record<string, unknown> {
  const d = defaultParagraphFormat();
  const slides = Array.isArray(raw.slides)
    ? raw.slides.map((s) =>
        isRecord(s) && Array.isArray(s.objects)
          ? {
              ...s,
              objects: s.objects.map((o) =>
                isRecord(o)
                  ? {
                      ...o,
                      align: typeof o.align === "string" ? o.align : d.align,
                      indent: typeof o.indent === "number" ? o.indent : d.indent,
                      lineSpacing: typeof o.lineSpacing === "number" ? o.lineSpacing : d.lineSpacing,
                      direction: typeof o.direction === "string" ? o.direction : d.direction,
                    }
                  : o,
              ),
            }
          : s,
      )
    : raw.slides;
  return { ...raw, schemaVersion: 5, slides };
}

/** v5 -> v6: list style (none by default, so nothing changes visually). */
function migrateV5(raw: Record<string, unknown>): Record<string, unknown> {
  const slides = Array.isArray(raw.slides)
    ? raw.slides.map((s) =>
        isRecord(s) && Array.isArray(s.objects)
          ? { ...s, objects: s.objects.map((o) => (isRecord(o) ? { ...o, list: typeof o.list === "string" ? o.list : "none" } : o)) }
          : s,
      )
    : raw.slides;
  return { ...raw, schemaVersion: 6, slides };
}

/** v6 -> v7: text box margins, vertical alignment and overflow, with the values text was already drawn with. */
function migrateV6(raw: Record<string, unknown>): Record<string, unknown> {
  const d = defaultBoxFormat();
  const slides = Array.isArray(raw.slides)
    ? raw.slides.map((s) =>
        isRecord(s) && Array.isArray(s.objects)
          ? {
              ...s,
              objects: s.objects.map((o) =>
                isRecord(o)
                  ? {
                      ...o,
                      margins: isRecord(o.margins) ? o.margins : d.margins,
                      verticalAlign: typeof o.verticalAlign === "string" ? o.verticalAlign : d.verticalAlign,
                      overflow: typeof o.overflow === "string" ? o.overflow : d.overflow,
                    }
                  : o,
              ),
            }
          : s,
      )
    : raw.slides;
  return { ...raw, schemaVersion: 7, slides };
}

/** v7 -> v8: objects can be grouped and locked. Nothing is grouped or locked until the user does it. */
function migrateV7(raw: Record<string, unknown>): Record<string, unknown> {
  const slides = Array.isArray(raw.slides)
    ? raw.slides.map((s) =>
        isRecord(s) && Array.isArray(s.objects)
          ? {
              ...s,
              objects: s.objects.map((o) =>
                isRecord(o)
                  ? {
                      ...o,
                      groupId: typeof o.groupId === "string" || o.groupId === null ? o.groupId : null,
                      locked: typeof o.locked === "boolean" ? o.locked : false,
                    }
                  : o,
              ),
            }
          : s,
      )
    : raw.slides;
  return { ...raw, schemaVersion: 8, slides };
}

/** Upgrades older stored documents to the current schema, then validates. Unknown versions are rejected, not guessed at. */
export function parsePresentation(raw: unknown): ValidationResult {
  let doc: unknown = raw;
  if (isRecord(doc) && doc.schemaVersion === 1) doc = migrateV1(doc);
  if (isRecord(doc) && doc.schemaVersion === 2) doc = migrateV2(doc);
  if (isRecord(doc) && doc.schemaVersion === 3) doc = migrateV3(doc);
  if (isRecord(doc) && doc.schemaVersion === 4) doc = migrateV4(doc);
  if (isRecord(doc) && doc.schemaVersion === 5) doc = migrateV5(doc);
  if (isRecord(doc) && doc.schemaVersion === 6) doc = migrateV6(doc);
  if (isRecord(doc) && doc.schemaVersion === 7) doc = migrateV7(doc);
  return validatePresentation(doc);
}
