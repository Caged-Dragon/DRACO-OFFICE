import { DEFAULT_SLIDE_SIZE, SLIDE_SIZES, type SlideSizeId } from "./sizes";
import { DOCUMENT_SCHEMA_VERSION, type Presentation, type Slide } from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

export function createSlide(name = "Untitled slide", title = "Click to add title"): Slide {
  return {
    id: newId(),
    name,
    objects: [
      { id: newId(), type: "text", role: "title", name: "Title", x: 80, y: 60, width: 800, height: 100, rotation: 0, visible: true, text: title, fontSize: 44 },
      { id: newId(), type: "text", role: "body", name: "Body", x: 80, y: 200, width: 800, height: 260, rotation: 0, visible: true, text: "Click to add text", fontSize: 24 },
    ],
  };
}

/** Smallest "Slide N" (N above the slide count) that no slide already uses. */
export function nextSlideName(slides: Slide[]): string {
  const used = new Set(slides.map((s) => s.name));
  let n = slides.length + 1;
  while (used.has(`Slide ${n}`)) n++;
  return `Slide ${n}`;
}

/** Copy of a slide with fresh ids. Objects are flat today; deepen the clone when nested objects arrive. */
export function duplicateSlide(slide: Slide): Slide {
  return {
    ...slide,
    id: newId(),
    name: `${slide.name} (copy)`.slice(0, 100),
    objects: slide.objects.map((o) => ({ ...o, id: newId() })),
  };
}

export interface CreatePresentationOptions {
  size?: SlideSizeId;
  author?: string;
  createdWith?: string;
}

export function createPresentation(
  title = "Untitled presentation",
  options: CreatePresentationOptions = {},
): Presentation {
  const now = new Date().toISOString();
  const size = SLIDE_SIZES[options.size ?? DEFAULT_SLIDE_SIZE];
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: newId(),
    title,
    width: size.width,
    height: size.height,
    metadata: {
      author: options.author ?? "",
      description: "",
      language: "en",
      createdWith: options.createdWith ?? "unknown",
    },
    createdAt: now,
    updatedAt: now,
    slides: [createSlide("Slide 1", title)],
  };
}
