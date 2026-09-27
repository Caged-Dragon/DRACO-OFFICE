export type TextStats = {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  readingTimeMinutes: number;
};

const WORDS_PER_MINUTE = 200;

export function computeTextStats(text: string): TextStats {
  const trimmed = text.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const readingTimeMinutes =
    words === 0 ? 0 : Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));

  return { words, characters, charactersNoSpaces, readingTimeMinutes };
}

export function formatReadingTime(minutes: number): string {
  if (minutes === 0) return "0 min read";
  if (minutes === 1) return "1 min read";
  return `${minutes} min read`;
}
