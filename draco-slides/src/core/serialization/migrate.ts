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

/** Upgrades older stored documents to the current schema, then validates. Unknown versions are rejected, not guessed at. */
export function parsePresentation(raw: unknown): ValidationResult {
  let doc: unknown = raw;
  if (isRecord(doc) && doc.schemaVersion === 1) doc = migrateV1(doc);
  if (isRecord(doc) && doc.schemaVersion === 2) doc = migrateV2(doc);
  return validatePresentation(doc);
}
