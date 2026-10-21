import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export type Match = { from: number; to: number };

type SearchState = {
  searchTerm: string;
  matches: Match[];
  currentIndex: number;
};

const searchPluginKey = new PluginKey<SearchState>("findAndReplace");

function findMatches(doc: ProseMirrorNode, term: string): Match[] {
  if (!term) return [];
  const results: Match[] = [];
  const lowerTerm = term.toLowerCase();
  // Matches within a single text node only — a match split across a mark
  // boundary (e.g. "hel**lo**" searching "hello") won't be found. A known,
  // documented limitation, common to naive find-in-editor implementations.
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const lowerText = node.text.toLowerCase();
    let idx = 0;
    for (;;) {
      const found = lowerText.indexOf(lowerTerm, idx);
      if (found === -1) break;
      results.push({ from: pos + found, to: pos + found + term.length });
      idx = found + term.length;
    }
  });
  return results;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    findAndReplace: {
      setSearchTerm: (term: string) => ReturnType;
      findNext: () => ReturnType;
      findPrevious: () => ReturnType;
      replaceCurrent: (replaceTerm: string) => ReturnType;
      replaceAll: (replaceTerm: string) => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

const FindAndReplace = Extension.create({
  name: "findAndReplace",

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchPluginKey,
        state: {
          init: () => ({ searchTerm: "", matches: [], currentIndex: -1 }),
          apply(tr, prev) {
            const meta = tr.getMeta(searchPluginKey) as
              | Partial<SearchState>
              | undefined;

            if (meta?.searchTerm !== undefined) {
              const matches = findMatches(tr.doc, meta.searchTerm);
              return {
                searchTerm: meta.searchTerm,
                matches,
                currentIndex: matches.length ? 0 : -1,
              };
            }

            if (meta?.currentIndex !== undefined) {
              return { ...prev, currentIndex: meta.currentIndex };
            }

            // Doc changed for an unrelated reason (typing, formatting) —
            // recompute matches against the new doc so positions stay valid.
            if (tr.docChanged && prev.searchTerm) {
              const matches = findMatches(tr.doc, prev.searchTerm);
              return {
                searchTerm: prev.searchTerm,
                matches,
                currentIndex: matches.length
                  ? Math.min(prev.currentIndex, matches.length - 1)
                  : -1,
              };
            }

            return prev;
          },
        },
        props: {
          decorations(state) {
            const pluginState = searchPluginKey.getState(state);
            if (!pluginState || pluginState.matches.length === 0) return null;
            const decorations = pluginState.matches.map((match, i) =>
              Decoration.inline(match.from, match.to, {
                class:
                  i === pluginState.currentIndex
                    ? "search-match search-match-current"
                    : "search-match",
              })
            );
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchPluginKey, { searchTerm: term }));
          return true;
        },
      findNext:
        () =>
        ({ state, tr, dispatch }) => {
          const pluginState = searchPluginKey.getState(state);
          if (!pluginState || pluginState.matches.length === 0) return false;
          const next = (pluginState.currentIndex + 1) % pluginState.matches.length;
          if (dispatch) dispatch(tr.setMeta(searchPluginKey, { currentIndex: next }));
          return true;
        },
      findPrevious:
        () =>
        ({ state, tr, dispatch }) => {
          const pluginState = searchPluginKey.getState(state);
          if (!pluginState || pluginState.matches.length === 0) return false;
          const count = pluginState.matches.length;
          const prevIndex = (pluginState.currentIndex - 1 + count) % count;
          if (dispatch) dispatch(tr.setMeta(searchPluginKey, { currentIndex: prevIndex }));
          return true;
        },
      replaceCurrent:
        (replaceTerm: string) =>
        ({ state, tr, dispatch }) => {
          const pluginState = searchPluginKey.getState(state);
          if (!pluginState || pluginState.currentIndex === -1) return false;
          const match = pluginState.matches[pluginState.currentIndex];
          if (!match) return false;
          tr.insertText(replaceTerm, match.from, match.to);
          // Re-run the search against the post-replace doc so match
          // positions/count stay correct (handled by the plugin's apply()
          // on docChanged).
          tr.setMeta(searchPluginKey, { searchTerm: pluginState.searchTerm });
          if (dispatch) dispatch(tr);
          return true;
        },
      replaceAll:
        (replaceTerm: string) =>
        ({ state, tr, dispatch }) => {
          const pluginState = searchPluginKey.getState(state);
          if (!pluginState || pluginState.matches.length === 0) return false;
          // Replace from the end backwards so earlier match positions don't
          // shift as later-in-document matches are replaced first.
          const sorted = [...pluginState.matches].sort((a, b) => b.from - a.from);
          for (const match of sorted) {
            tr.insertText(replaceTerm, match.from, match.to);
          }
          tr.setMeta(searchPluginKey, { searchTerm: pluginState.searchTerm });
          if (dispatch) dispatch(tr);
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchPluginKey, { searchTerm: "" }));
          return true;
        },
    };
  },
});

export { searchPluginKey };
export default FindAndReplace;
