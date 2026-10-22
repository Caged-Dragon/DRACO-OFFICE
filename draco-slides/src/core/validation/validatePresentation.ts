import {
  DOCUMENT_SCHEMA_VERSION,
  MAX_OBJECTS_PER_SLIDE,
  MAX_SLIDES,
  MAX_SLIDE_DIMENSION,
  MIN_SLIDE_DIMENSION,
  type Presentation,
} from "../document-model/types";

export type ValidationResult = { ok: true; value: Presentation } | { ok: false; errors: string[] };

const MAX_ERRORS = 25;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isDate = (v: unknown): boolean => isStr(v) && !Number.isNaN(Date.parse(v));

/** Strict structural check of a current-schema document. Does not modify the input. */
export function validatePresentation(value: unknown): ValidationResult {
  const errors: string[] = [];
  const fail = (msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(msg);
  };

  if (!isRecord(value)) return { ok: false, errors: ["Document is not an object"] };

  if (value.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
    fail(`Unsupported schema version ${String(value.schemaVersion)} (expected ${DOCUMENT_SCHEMA_VERSION})`);
  }
  if (!isStr(value.id) || value.id === "") fail("Presentation id is missing");
  if (!isStr(value.title)) fail("Presentation title must be text");
  if (!isDate(value.createdAt)) fail("createdAt is not a valid date");
  if (!isDate(value.updatedAt)) fail("updatedAt is not a valid date");

  for (const key of ["width", "height"] as const) {
    const n = value[key];
    if (!isNum(n) || n < MIN_SLIDE_DIMENSION || n > MAX_SLIDE_DIMENSION) {
      fail(`Slide ${key} must be a number between ${MIN_SLIDE_DIMENSION} and ${MAX_SLIDE_DIMENSION}`);
    }
  }

  const meta = value.metadata;
  if (!isRecord(meta)) {
    fail("metadata is missing");
  } else {
    for (const key of ["author", "description", "language", "createdWith"]) {
      if (!isStr(meta[key])) fail(`metadata.${key} must be text`);
    }
  }

  const seen = new Set<string>();
  const checkId = (id: unknown, where: string) => {
    if (!isStr(id) || id === "") return fail(`${where}: id is missing`);
    if (seen.has(id)) return fail(`${where}: duplicate id ${id}`);
    seen.add(id);
  };

  if (!Array.isArray(value.slides) || value.slides.length === 0) {
    fail("A presentation needs at least one slide");
  } else if (value.slides.length > MAX_SLIDES) {
    fail(`A presentation can have at most ${MAX_SLIDES} slides`);
  } else {
    value.slides.forEach((slide, i) => {
      const sw = `slides[${i}]`;
      if (!isRecord(slide)) return fail(`${sw}: not an object`);
      checkId(slide.id, sw);
      if (!isStr(slide.name)) fail(`${sw}: name must be text`);
      if (!Array.isArray(slide.objects)) return fail(`${sw}: objects must be a list`);
      if (slide.objects.length > MAX_OBJECTS_PER_SLIDE) return fail(`${sw}: at most ${MAX_OBJECTS_PER_SLIDE} objects per slide`);
      slide.objects.forEach((o, j) => {
        const ow = `${sw}.objects[${j}]`;
        if (!isRecord(o)) return fail(`${ow}: not an object`);
        checkId(o.id, ow);
        if (!isStr(o.name)) fail(`${ow}: name must be text`);
        for (const key of ["x", "y", "rotation"] as const) {
          if (!isNum(o[key])) fail(`${ow}: ${key} must be a finite number`);
        }
        for (const key of ["width", "height"] as const) {
          if (!isNum(o[key]) || o[key] < 0) fail(`${ow}: ${key} must be a number, zero or more`);
        }
        if (typeof o.visible !== "boolean") fail(`${ow}: visible must be true or false`);
        if (o.type !== "text") {
          fail(`${ow}: unknown object type ${String(o.type)}`);
        } else {
          if (o.role !== "title" && o.role !== "body") fail(`${ow}: role must be title or body`);
          if (!isStr(o.text)) fail(`${ow}: text must be text`);
          if (!isNum(o.fontSize) || o.fontSize <= 0) fail(`${ow}: fontSize must be above zero`);
        }
      });
    });
  }

  return errors.length === 0 ? { ok: true, value: value as unknown as Presentation } : { ok: false, errors };
}
