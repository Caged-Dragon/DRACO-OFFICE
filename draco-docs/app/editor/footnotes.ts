export type Footnote = {
  id: string;
  text: string;
};

export function generateFootnoteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `fn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createFootnote(text = ""): Footnote {
  return { id: generateFootnoteId(), text };
}

export function updateFootnoteText(
  footnotes: Footnote[],
  id: string,
  text: string
): Footnote[] {
  return footnotes.map((f) => (f.id === id ? { ...f, text } : f));
}

export function removeFootnote(footnotes: Footnote[], id: string): Footnote[] {
  return footnotes.filter((f) => f.id !== id);
}

export type NumberedFootnote = { number: number; id: string; text: string };

/**
 * Join the persisted footnote text against the document's live numbering
 * (from footnote-extension.ts's getFootnoteNumbers). A footnote whose
 * reference was deleted from the document (no entry in `numbers`) is
 * dropped — an orphaned note with no reference has nothing to be numbered
 * against, and showing it would be confusing rather than helpful.
 */
export function joinFootnotesWithNumbers(
  footnotes: Footnote[],
  numbers: Map<string, number>
): NumberedFootnote[] {
  const byId = new Map(footnotes.map((f) => [f.id, f]));
  const joined: NumberedFootnote[] = [];
  for (const [id, number] of numbers) {
    const footnote = byId.get(id);
    joined.push({ number, id, text: footnote?.text ?? "" });
  }
  return joined.sort((a, b) => a.number - b.number);
}

/**
 * Validate untrusted input (localStorage, a .dwdoc file) into a safe
 * Footnote[]. Never throws; drops anything malformed.
 */
export function sanitizeFootnotes(input: unknown): Footnote[] {
  if (!Array.isArray(input)) return [];
  const out: Footnote[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    if (typeof f.id !== "string") continue;
    out.push({ id: f.id, text: typeof f.text === "string" ? f.text : "" });
  }
  return out;
}
