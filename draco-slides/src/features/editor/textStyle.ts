import type { CSSProperties } from "react";
import { cssFontFamily } from "../../core/document-model/fonts";
import { INDENT_STEP } from "../../core/document-model/paragraph";
import type { BoxFormat, ListStyle, ParagraphFormat, TextFormat } from "../../core/document-model/types";

/** The one place that turns a text object's formatting into CSS, so the canvas, thumbnails and editor always agree. */
export function textStyle(f: TextFormat & ParagraphFormat & BoxFormat): CSSProperties {
  const indent = f.indent * INDENT_STEP;
  const left = f.margins.left + (f.direction === "ltr" ? indent : 0);
  const right = f.margins.right + (f.direction === "rtl" ? indent : 0);
  const decoration = [f.underline && "underline", f.strike && "line-through"].filter(Boolean).join(" ");
  return {
    fontFamily: cssFontFamily(f.fontFamily),
    fontSize: f.fontSize,
    fontWeight: f.bold ? 700 : 400,
    fontStyle: f.italic ? "italic" : "normal",
    textDecoration: decoration || "none",
    color: f.color,
    textAlign: f.align,
    lineHeight: f.lineSpacing,
    // Internal margins plus the indent, which starts from the reading-start edge (left in LTR, right in RTL text).
    paddingTop: f.margins.top > 0 ? f.margins.top : undefined,
    paddingRight: right > 0 ? right : undefined,
    paddingBottom: f.margins.bottom > 0 ? f.margins.bottom : undefined,
    paddingLeft: left > 0 ? left : undefined,
  };
}

/** Class names that turn the paragraphs of a text object into a bulleted or numbered list (see global.css). */
export const listClassName = (list: ListStyle): string => (list === "none" ? "" : ` rt-list rt-list--${list}`);

/** All class names that depend on how the text sits in its box: list markers, vertical alignment, overflow. */
export const textClassNames = (f: ParagraphFormat & BoxFormat): string =>
  `${listClassName(f.list)}${f.verticalAlign === "top" ? "" : ` rt-v--${f.verticalAlign}`}${f.overflow === "visible" ? " rt-overflow--visible" : ""}`;
