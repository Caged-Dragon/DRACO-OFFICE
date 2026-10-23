import type { Point } from "../../core/geometry/viewport";

/**
 * Text objects store plain text where "\n" separates lines (paragraphs). While a text object is being
 * edited the browser owns the contenteditable DOM, so these helpers convert in both directions.
 * Rich formatting (runs and marks) arrives in Version 13.
 */

const BLOCK = new Set(["DIV", "P", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "SECTION", "ARTICLE", "TABLE", "TR"]);
const SKIP = new Set(["SCRIPT", "STYLE"]);

/**
 * Reads the text of an editing surface. Handles what browsers produce: a div (or p) per line, <br> line
 * breaks, nested inline elements, stray top-level text, and "\n" inside text nodes (the surface uses
 * white-space: pre-wrap). A trailing <br> inside a line does not add an extra empty line.
 */
export function domToText(root: Node): string {
  const lines: string[] = [];
  let cur: string | null = null;
  const flush = () => {
    lines.push(cur ?? "");
    cur = null;
  };
  const addText = (raw: string) => {
    const clean = raw.replace(/\u00a0/g, " ").replace(/[\u200b\u200c\u200d\ufeff]/g, "").replace(/\r\n?/g, "\n");
    clean.split("\n").forEach((part, i) => {
      if (i > 0) flush();
      if (part) cur = (cur ?? "") + part;
    });
  };
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      addText(node.nodeValue ?? "");
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (SKIP.has(tag)) return;
    if (tag === "BR") {
      flush();
      return;
    }
    const block = BLOCK.has(tag);
    if (block && cur !== null) flush();
    el.childNodes.forEach(walk);
    if (block && cur !== null) flush();
  };
  root.childNodes.forEach(walk);
  if (cur !== null) flush();
  return lines.join("\n");
}

/** One div per line; an empty line holds a <br> so it keeps its height. Same structure as the canvas renders. */
export function textToDom(text: string, doc: Document): DocumentFragment {
  const frag = doc.createDocumentFragment();
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const div = doc.createElement("div");
    div.className = "rt-line";
    if (line === "") div.appendChild(doc.createElement("br"));
    else div.textContent = line;
    frag.appendChild(div);
  }
  return frag;
}

type CaretDoc = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

function caretRangeFromPoint(doc: Document, x: number, y: number): Range | null {
  const d = doc as CaretDoc;
  try {
    if (d.caretPositionFromPoint) {
      const pos = d.caretPositionFromPoint(x, y);
      if (!pos) return null;
      const r = doc.createRange();
      r.setStart(pos.offsetNode, pos.offset);
      r.collapse(true);
      return r;
    }
    return d.caretRangeFromPoint?.(x, y) ?? null;
  } catch {
    return null;
  }
}

function endOfContent(root: HTMLElement, doc: Document): Range {
  const range = doc.createRange();
  const last = root.lastChild;
  if (last && last.nodeType === 1) {
    const lastEl = last as Element;
    const tail = lastEl.lastChild;
    if (tail && tail.nodeType === 1 && (tail as Element).tagName === "BR") range.setStartBefore(tail);
    else {
      range.selectNodeContents(lastEl);
      range.collapse(false);
      return range;
    }
    range.collapse(true);
    return range;
  }
  range.selectNodeContents(root);
  range.collapse(false);
  return range;
}

/** Puts the caret where the user double-clicked, or at the end of the text when that is unknown or outside the editor. */
export function placeCaret(root: HTMLElement, point: Point | null, doc: Document = document): void {
  const sel = doc.getSelection();
  if (!sel) return;
  let range = point ? caretRangeFromPoint(doc, point.x, point.y) : null;
  if (!range || !root.contains(range.startContainer)) range = endOfContent(root, doc);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Fallback for pasting plain text when document.execCommand is unavailable. */
export function insertTextAtSelection(root: HTMLElement, text: string, doc: Document = document): boolean {
  const sel = doc.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return false;
  range.deleteContents();
  const node = doc.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}
