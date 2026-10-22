/** Bump when the stored shape changes, and add a migration in core/serialization/migrate.ts. */
export const DOCUMENT_SCHEMA_VERSION = 2;

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
}

export interface TextObject extends BaseObject {
  type: "text";
  role: "title" | "body";
  text: string;
  fontSize: number;
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
