import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { DICTIONARY } from "./dictionary";

export type Misspelling = { from: number; to: number; word: string };

type SpellCheckState = {
  enabled: boolean;
  customWords: Set<string>;
  misspellings: Misspelling[];
};

const CUSTOM_DICTIONARY_KEY = "docwrite:customDictionary";
const WORD_PATTERN = /[A-Za-z']+/g;

export function loadCustomDictionary(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(CUSTOM_DICTIONARY_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function saveCustomDictionary(words: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CUSTOM_DICTIONARY_KEY,
      JSON.stringify([...words])
    );
  } catch {
    // Storage full or unavailable — custom words just won't persist.
  }
}

function isKnownWord(word: string, customWords: Set<string>): boolean {
  const lower = word.toLowerCase();
  return DICTIONARY.has(lower) || customWords.has(lower);
}

function findMisspellings(
  doc: ProseMirrorNode,
  customWords: Set<string>
): Misspelling[] {
  const results: Misspelling[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let match: RegExpExecArray | null;
    WORD_PATTERN.lastIndex = 0;
    while ((match = WORD_PATTERN.exec(text)) !== null) {
      const word = match[0];
      // Skip bare apostrophes and very short tokens that are usually not
      // real words (single letters like "a"/"I" are already in the
      // dictionary, so this mostly filters stray punctuation artifacts).
      if (word.replace(/'/g, "").length === 0) continue;
      if (!isKnownWord(word, customWords)) {
        results.push({
          from: pos + match.index,
          to: pos + match.index + word.length,
          word,
        });
      }
    }
  });
  return results;
}

/** Cheap Levenshtein distance, used only on-demand for suggestions. */
function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array(b.length + 1).fill(i === 0 ? 0 : 0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function suggestFor(word: string, limit = 3): string[] {
  const lower = word.toLowerCase();
  const candidates: { w: string; d: number }[] = [];
  for (const dictWord of DICTIONARY) {
    if (Math.abs(dictWord.length - lower.length) > 2) continue;
    const d = editDistance(lower, dictWord);
    if (d <= 2) candidates.push({ w: dictWord, d });
  }
  candidates.sort((a, b) => a.d - b.d);
  return candidates.slice(0, limit).map((c) => c.w);
}

const spellCheckPluginKey = new PluginKey<SpellCheckState>("spellCheck");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    spellCheck: {
      toggleSpellCheck: () => ReturnType;
      addWordToDictionary: (word: string) => ReturnType;
    };
  }
}

const SpellCheck = Extension.create({
  name: "spellCheck",

  addProseMirrorPlugins() {
    return [
      new Plugin<SpellCheckState>({
        key: spellCheckPluginKey,
        state: {
          init: (_config, state) => {
            const customWords = loadCustomDictionary();
            return {
              enabled: true,
              customWords,
              misspellings: findMisspellings(state.doc, customWords),
            };
          },
          apply(tr, prev) {
            const meta = tr.getMeta(spellCheckPluginKey) as
              | Partial<SpellCheckState>
              | undefined;

            let next = prev;

            if (meta?.enabled !== undefined) {
              next = { ...next, enabled: meta.enabled };
            }
            if (meta?.customWords !== undefined) {
              next = { ...next, customWords: meta.customWords };
            }

            if (
              tr.docChanged ||
              meta?.customWords !== undefined ||
              meta?.enabled !== undefined
            ) {
              next = {
                ...next,
                misspellings: next.enabled
                  ? findMisspellings(tr.doc, next.customWords)
                  : [],
              };
            }

            return next;
          },
        },
        props: {
          decorations(state) {
            const pluginState = spellCheckPluginKey.getState(state);
            if (!pluginState?.enabled || pluginState.misspellings.length === 0) {
              return null;
            }
            const decorations = pluginState.misspellings.map((m) =>
              Decoration.inline(m.from, m.to, { class: "spell-error" })
            );
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      toggleSpellCheck:
        () =>
        ({ state, tr, dispatch }) => {
          const pluginState = spellCheckPluginKey.getState(state);
          if (dispatch) {
            dispatch(
              tr.setMeta(spellCheckPluginKey, {
                enabled: !pluginState?.enabled,
              })
            );
          }
          return true;
        },
      addWordToDictionary:
        (word: string) =>
        ({ state, tr, dispatch }) => {
          const pluginState = spellCheckPluginKey.getState(state);
          if (!pluginState) return false;
          const nextWords = new Set(pluginState.customWords);
          nextWords.add(word.toLowerCase());
          saveCustomDictionary(nextWords);
          if (dispatch) {
            dispatch(tr.setMeta(spellCheckPluginKey, { customWords: nextWords }));
          }
          return true;
        },
    };
  },
});

export { spellCheckPluginKey };
export default SpellCheck;
