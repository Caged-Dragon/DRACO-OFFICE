/**
 * List levels live in the text: each leading tab on a line is one level (0 to 8), like an outline in plain text.
 * Whether the paragraphs show bullets, numbers or nothing is the object's `list` setting.
 */
export const MAX_LIST_LEVEL = 8;

export interface TextLine {
  level: number;
  content: string;
}

/** Splits text into lines with their list level. Tabs beyond the maximum level stay in the content. */
export function splitLines(text: string): TextLine[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((raw) => {
      let level = 0;
      while (level < MAX_LIST_LEVEL && raw[level] === "\t") level++;
      return { level, content: raw.slice(level) };
    });
}

export function joinLines(lines: TextLine[]): string {
  return lines.map((l) => "\t".repeat(l.level) + l.content).join("\n");
}

export const clampLevel = (n: number): number => (Number.isFinite(n) ? Math.min(MAX_LIST_LEVEL, Math.max(0, Math.round(n))) : 0);

/** Moves every line up or down by `delta` levels, stopping at 0 and the maximum. */
export function shiftLevels(text: string, delta: number): string {
  return joinLines(splitLines(text).map((l) => ({ ...l, level: clampLevel(l.level + delta) })));
}

/** Lowest and highest level used in the text. */
export function levelRange(text: string): { min: number; max: number } {
  const levels = splitLines(text).map((l) => l.level);
  return { min: Math.min(...levels), max: Math.max(...levels) };
}
