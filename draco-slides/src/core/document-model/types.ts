/** Bump when the stored shape changes, and add a migration in core/serialization/migrate.ts. */
export const DOCUMENT_SCHEMA_VERSION = 9;

export const MIN_SLIDE_DIMENSION = 100;
export const MAX_SLIDE_DIMENSION = 20000;
/** Sanity limits so a malformed or hostile file cannot make the editor unusable. */
export const MAX_SLIDES = 2000;
export const MAX_OBJECTS_PER_SLIDE = 2000;

/** Properties shared by every object that can sit on a slide. Units are slide pixels. */
export interface BaseObject {
  id: string;
  /** Human-readable name (used by later selection/accessibility features). */
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise. */
  rotation: number;
  /** Hidden objects stay in the document but are not rendered. */
  visible: boolean;
  /** Objects on a slide that share a groupId form a group (one level; groups cannot be nested). */
  groupId: string | null;
  /** A locked object cannot be moved, resized or deleted. Its text and formatting can still be edited. */
  locked: boolean;
}

/** Formatting of a whole text object (character-level formatting inside one object is not supported yet). */
export interface TextFormat {
  /** One of FONT_FAMILIES (core/document-model/fonts.ts). */
  fontFamily: string;
  /** Slide pixels. */
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  /** Lowercase "#rrggbb". */
  color: string;
}

export type Alignment = "left" | "center" | "right" | "justify";
export type Direction = "ltr" | "rtl";
export type ListStyle = "none" | "bullet" | "number";

/** Paragraph settings of a whole text object (they apply to every paragraph in it). */
export interface ParagraphFormat {
  /** Physical alignment of the text. */
  align: Alignment;
  /** Indent level, 0 to 8, in steps of INDENT_STEP slide pixels from the starting edge. */
  indent: number;
  /** Line height as a multiple of the font size. */
  lineSpacing: number;
  /** Base text direction; "rtl" makes right-to-left scripts (Arabic, Hebrew) lay out correctly. */
  direction: Direction;
  /**
   * List markers for every paragraph of the object. A paragraph's list level (0 to 8) is stored as leading tab
   * characters in `text`, so text stays the single source of truth.
   */
  list: ListStyle;
}

export type VerticalAlign = "top" | "middle" | "bottom";
/** What happens to text that does not fit the box: "hidden" clips it, "visible" lets it spill outside. */
export type OverflowMode = "hidden" | "visible";

/** Internal margins: the space between the box edge and its text, in slide pixels. */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** How the text sits inside its box. */
export interface BoxFormat {
  margins: Margins;
  verticalAlign: VerticalAlign;
  overflow: OverflowMode;
}

export type ShapeKind = "rectangle" | "roundRect" | "ellipse" | "line";

/**
 * How the object's box is drawn. As in PowerPoint every object is a shape that can hold text: a text box is a
 * rectangle with no fill and no outline, and a drawn rectangle can have text typed into it. Lines carry no text.
 */
export interface ShapeStyle {
  shape: ShapeKind;
  /** Lowercase "#rrggbb", or null for no fill. */
  fill: string | null;
  /** Lowercase "#rrggbb", or null for no outline. */
  stroke: string | null;
  /** Outline width in slide pixels. */
  strokeWidth: number;
  /** Lines only: false runs from the top-left to the bottom-right corner of the box, true from the bottom-left to the top-right. */
  flipV: boolean;
}

export interface TextObject extends BaseObject, TextFormat, ParagraphFormat, BoxFormat, ShapeStyle {
  type: "text";
  /** "title" and "body" are slide placeholders; "textbox" is a free text box the user inserted. */
  role: "title" | "body" | "textbox" | "shape";
  text: string;
}

/** Union grows as shapes, images, tables, charts and media are added. */
export type SlideObject = TextObject;

export interface Slide {
  id: string;
  name: string;
  objects: SlideObject[];
}

export interface PresentationMetadata {
  author: string;
  description: string;
  /** BCP 47 language tag of the content. */
  language: string;
  /** Draco Slides version that created the document. */
  createdWith: string;
}

export interface Presentation {
  schemaVersion: number;
  id: string;
  title: string;
  /** Slide size in slide pixels; every slide in a presentation shares it. */
  width: number;
  height: number;
  metadata: PresentationMetadata;
  createdAt: string;
  updatedAt: string;
  slides: Slide[];
}
