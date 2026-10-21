import {
  DOCUMENT_SCHEMA_VERSION,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type Presentation,
  type Slide,
} from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

export function createSlide(name = "Untitled slide", title = "Click to add title"): Slide {
  return {
    id: newId(),
    name,
    objects: [
      { id: newId(), type: "text", role: "title", x: 80, y: 60, width: 800, height: 100, text: title, fontSize: 44 },
      { id: newId(), type: "text", role: "body", x: 80, y: 200, width: 800, height: 260, text: "Click to add text", fontSize: 24 },
    ],
  };
}

export function createPresentation(title = "Untitled presentation"): Presentation {
  const now = new Date().toISOString();
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: newId(),
    title,
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    createdAt: now,
    updatedAt: now,
    slides: [createSlide("Slide 1", title)],
  };
}

/** Defensive check for data loaded from storage. */
export function isPresentation(value: unknown): value is Presentation {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Partial<Presentation>;
  return (
    typeof p.id === "string" &&
    typeof p.title === "string" &&
    p.schemaVersion === DOCUMENT_SCHEMA_VERSION &&
    Array.isArray(p.slides) &&
    p.slides.length > 0 &&
    p.slides.every((s) => typeof s?.id === "string" && Array.isArray(s.objects))
  );
}
