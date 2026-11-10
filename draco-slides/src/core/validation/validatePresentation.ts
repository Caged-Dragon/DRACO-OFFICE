import { MAX_STROKE_WIDTH, SHAPE_KINDS } from "../document-model/shapes";
import { OVERFLOW_MODES, VERTICAL_ALIGNS, isValidMargins } from "../document-model/box";
import { FONT_FAMILY_NAMES, normalizeColor } from "../document-model/fonts";
import { ALIGNMENTS, DIRECTIONS, LIST_STYLES, MAX_INDENT_LEVEL, MAX_LINE_SPACING, MIN_LINE_SPACING } from "../document-model/paragraph";
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
        if (typeof o.locked !== "boolean") fail(`${ow}: locked must be true or false`);
        if (o.groupId !== null && (!isStr(o.groupId) || o.groupId === "")) fail(`${ow}: groupId must be null or an id`);
        if (o.type !== "text") {
          fail(`${ow}: unknown object type ${String(o.type)}`);
        } else {
          if (o.role !== "title" && o.role !== "body" && o.role !== "textbox" && o.role !== "shape") {
            fail(`${ow}: role must be title, body, textbox or shape`);
          }
          if (!SHAPE_KINDS.includes(o.shape as never)) fail(`${ow}: shape must be rectangle, roundRect, ellipse or line`);
          for (const key of ["fill", "stroke"] as const) {
            if (o[key] !== null && normalizeColor(o[key]) === null) fail(`${ow}: ${key} must be null or a hex colour`);
          }
          if (!isNum(o.strokeWidth) || o.strokeWidth < 0 || o.strokeWidth > MAX_STROKE_WIDTH) {
            fail(`${ow}: strokeWidth must be between 0 and ${MAX_STROKE_WIDTH}`);
          }
          if (typeof o.flipV !== "boolean") fail(`${ow}: flipV must be true or false`);
          if (!isStr(o.text)) fail(`${ow}: text must be text`);
          if (!isNum(o.fontSize) || o.fontSize <= 0 || o.fontSize > 1000) {
            fail(`${ow}: fontSize must be above zero and at most 1000`);
          }
          if (!isStr(o.fontFamily) || !FONT_FAMILY_NAMES.includes(o.fontFamily)) fail(`${ow}: unknown font family`);
          for (const key of ["bold", "italic", "underline", "strike"] as const) {
            if (typeof o[key] !== "boolean") fail(`${ow}: ${key} must be true or false`);
          }
          if (normalizeColor(o.color) === null) fail(`${ow}: color must be a hex colour such as #1d1d1d`);
          if (!ALIGNMENTS.includes(o.align as never)) fail(`${ow}: align must be left, center, right or justify`);
          if (!DIRECTIONS.includes(o.direction as never)) fail(`${ow}: direction must be ltr or rtl`);
          if (!isValidMargins(o.margins)) fail(`${ow}: margins must be four numbers from 0 to 200`);
          if (!VERTICAL_ALIGNS.includes(o.verticalAlign as never)) fail(`${ow}: verticalAlign must be top, middle or bottom`);
          if (!OVERFLOW_MODES.includes(o.overflow as never)) fail(`${ow}: overflow must be hidden or visible`);
          if (!LIST_STYLES.includes(o.list as never)) fail(`${ow}: list must be none, bullet or number`);
          if (!isNum(o.indent) || !Number.isInteger(o.indent) || o.indent < 0 || o.indent > MAX_INDENT_LEVEL) {
            fail(`${ow}: indent must be a whole number from 0 to ${MAX_INDENT_LEVEL}`);
          }
          if (!isNum(o.lineSpacing) || o.lineSpacing < MIN_LINE_SPACING || o.lineSpacing > MAX_LINE_SPACING) {
            fail(`${ow}: lineSpacing must be between ${MIN_LINE_SPACING} and ${MAX_LINE_SPACING}`);
          }
        }
      });
    });
  }

  return errors.length === 0 ? { ok: true, value: value as unknown as Presentation } : { ok: false, errors };
}
