import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";

export function generateChangeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const AUTHOR = "You"; // single-user phase — see comments.ts for the same scoping note

const commonAttrs = {
  changeId: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute("data-change-id"),
    renderHTML: (attrs: { changeId?: string | null }) =>
      attrs.changeId ? { "data-change-id": attrs.changeId } : {},
  },
  author: {
    default: AUTHOR,
    parseHTML: (el: HTMLElement) => el.getAttribute("data-author") ?? AUTHOR,
    renderHTML: (attrs: { author?: string }) => ({
      "data-author": attrs.author ?? AUTHOR,
    }),
  },
  createdAt: {
    default: "",
    parseHTML: (el: HTMLElement) => el.getAttribute("data-created-at") ?? "",
    renderHTML: (attrs: { createdAt?: string }) => ({
      "data-created-at": attrs.createdAt ?? "",
    }),
  },
};

export const InsertionMark = Mark.create({
  name: "insertion",
  inclusive: false,
  addAttributes() {
    return commonAttrs;
  },
  parseHTML() {
    return [{ tag: "ins[data-change-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["ins", mergeAttributes(HTMLAttributes, { class: "tc-insertion" }), 0];
  },
});

export const DeletionMark = Mark.create({
  name: "deletion",
  inclusive: false,
  addAttributes() {
    return commonAttrs;
  },
  parseHTML() {
    return [{ tag: "del[data-change-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["del", mergeAttributes(HTMLAttributes, { class: "tc-deletion" }), 0];
  },
});

type TrackChangesState = { enabled: boolean };
const trackChangesPluginKey = new PluginKey<TrackChangesState>("trackChanges");
const SKIP_META = "trackChangesSkip";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    trackChanges: {
      setTrackChangesEnabled: (enabled: boolean) => ReturnType;
      acceptChange: (changeId: string) => ReturnType;
      rejectChange: (changeId: string) => ReturnType;
      acceptAllChanges: () => ReturnType;
      rejectAllChanges: () => ReturnType;
    };
  }
}

/** True only when every top-level child of the slice is text/inline — the
 *  flat-content guard that keeps the appendTransaction rewrite safe. */
function isInlineOnlyFragment(fragment: {
  forEach: (fn: (node: { isText: boolean; isInline: boolean }) => void) => void;
}): boolean {
  let ok = true;
  fragment.forEach((node) => {
    if (!node.isText && !node.isInline) ok = false;
  });
  return ok;
}

const TrackChanges = Extension.create({
  name: "trackChangesController",

  addExtensions() {
    return [InsertionMark, DeletionMark];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<TrackChangesState>({
        key: trackChangesPluginKey,
        state: {
          init: () => ({ enabled: false }),
          apply(tr, prev) {
            const meta = tr.getMeta(trackChangesPluginKey) as
              | { enabled: boolean }
              | undefined;
            return meta ? { enabled: meta.enabled } : prev;
          },
        },

        // Scope (documented in CHANGELOG): only plain inline edits within a
        // single block, produced by exactly one transaction with exactly
        // one ReplaceStep — i.e. normal typing, Backspace/Delete, and
        // typing over a selection. Anything structural (paragraph merges,
        // table edits, block-level paste, multi-step transactions such as
        // programmatic setContent) passes through untracked rather than
        // risking an invalid document from a generic, unverified rewrite.
        appendTransaction(transactions, oldState, newState) {
          const pluginState = trackChangesPluginKey.getState(oldState);
          if (!pluginState?.enabled) return null;
          if (transactions.length !== 1) return null;
          const transaction = transactions[0];
          if (!transaction.docChanged) return null;
          if (transaction.getMeta(SKIP_META)) return null;
          if (transaction.steps.length !== 1) return null;

          const step = transaction.steps[0];
          if (!(step instanceof ReplaceStep)) return null;

          const { from, to, slice } = step;
          const before = transaction.before;

          const $from = before.resolve(from);
          const $to = before.resolve(to);
          if ($from.parent !== $to.parent) return null; // crosses a block boundary
          if (slice.openStart !== 0 || slice.openEnd !== 0) return null;
          if (!isInlineOnlyFragment(slice.content)) return null;

          const removedSlice = before.slice(from, to);
          if (!isInlineOnlyFragment(removedSlice.content)) return null;

          const insertedSize = slice.size;
          const removedSize = removedSlice.size;
          if (insertedSize === 0 && removedSize === 0) return null;

          const tr = newState.tr;
          const changeId = generateChangeId();
          const createdAt = new Date().toISOString();
          const insertEnd = from + insertedSize;

          if (insertedSize > 0) {
            tr.addMark(
              from,
              insertEnd,
              newState.schema.marks.insertion.create({ changeId, author: AUTHOR, createdAt })
            );
          }
          if (removedSize > 0) {
            tr.insert(insertEnd, removedSlice.content);
            tr.addMark(
              insertEnd,
              insertEnd + removedSize,
              newState.schema.marks.deletion.create({ changeId, author: AUTHOR, createdAt })
            );
          }

          tr.setMeta(SKIP_META, true);
          return tr;
        },
      }),
    ];
  },

  addCommands() {
    return {
      setTrackChangesEnabled:
        (enabled: boolean) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(trackChangesPluginKey, { enabled }));
          return true;
        },

      acceptChange:
        (changeId: string) =>
        ({ tr, state, dispatch }) => {
          const ranges: { from: number; to: number; type: "insertion" | "deletion" }[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            const mark = node.marks.find(
              (m) =>
                (m.type.name === "insertion" || m.type.name === "deletion") &&
                m.attrs.changeId === changeId
            );
            if (mark) {
              ranges.push({
                from: pos,
                to: pos + node.nodeSize,
                type: mark.type.name as "insertion" | "deletion",
              });
            }
          });
          if (ranges.length === 0) return false;
          ranges
            .sort((a, b) => b.from - a.from)
            .forEach((r) => {
              if (r.type === "deletion") {
                tr.delete(r.from, r.to);
              } else {
                tr.removeMark(r.from, r.to, state.schema.marks.insertion);
              }
            });
          if (dispatch) dispatch(tr);
          return true;
        },

      rejectChange:
        (changeId: string) =>
        ({ tr, state, dispatch }) => {
          const ranges: { from: number; to: number; type: "insertion" | "deletion" }[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            const mark = node.marks.find(
              (m) =>
                (m.type.name === "insertion" || m.type.name === "deletion") &&
                m.attrs.changeId === changeId
            );
            if (mark) {
              ranges.push({
                from: pos,
                to: pos + node.nodeSize,
                type: mark.type.name as "insertion" | "deletion",
              });
            }
          });
          if (ranges.length === 0) return false;
          ranges
            .sort((a, b) => b.from - a.from)
            .forEach((r) => {
              if (r.type === "insertion") {
                tr.delete(r.from, r.to);
              } else {
                tr.removeMark(r.from, r.to, state.schema.marks.deletion);
              }
            });
          if (dispatch) dispatch(tr);
          return true;
        },

      acceptAllChanges:
        () =>
        ({ tr, state, dispatch }) => {
          const ranges: { from: number; to: number; type: "insertion" | "deletion" }[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            for (const m of node.marks) {
              if (m.type.name === "insertion" || m.type.name === "deletion") {
                ranges.push({ from: pos, to: pos + node.nodeSize, type: m.type.name as "insertion" | "deletion" });
                break;
              }
            }
          });
          if (ranges.length === 0) return false;
          ranges
            .sort((a, b) => b.from - a.from)
            .forEach((r) => {
              if (r.type === "deletion") tr.delete(r.from, r.to);
              else tr.removeMark(r.from, r.to, state.schema.marks.insertion);
            });
          if (dispatch) dispatch(tr);
          return true;
        },

      rejectAllChanges:
        () =>
        ({ tr, state, dispatch }) => {
          const ranges: { from: number; to: number; type: "insertion" | "deletion" }[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            for (const m of node.marks) {
              if (m.type.name === "insertion" || m.type.name === "deletion") {
                ranges.push({ from: pos, to: pos + node.nodeSize, type: m.type.name as "insertion" | "deletion" });
                break;
              }
            }
          });
          if (ranges.length === 0) return false;
          ranges
            .sort((a, b) => b.from - a.from)
            .forEach((r) => {
              if (r.type === "insertion") tr.delete(r.from, r.to);
              else tr.removeMark(r.from, r.to, state.schema.marks.deletion);
            });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});

export { trackChangesPluginKey };
export default TrackChanges;
