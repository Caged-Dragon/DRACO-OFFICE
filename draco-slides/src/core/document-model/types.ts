export const SLIDE_WIDTH = 960;
export const SLIDE_HEIGHT = 540;
export const DOCUMENT_SCHEMA_VERSION = 1;

export interface TextObject {
  id: string;
  type: "text";
  role: "title" | "body";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
}

export type SlideObject = TextObject;

export interface Slide {
  id: string;
  name: string;
  objects: SlideObject[];
}

export interface Presentation {
  schemaVersion: number;
  id: string;
  title: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  slides: Slide[];
}
