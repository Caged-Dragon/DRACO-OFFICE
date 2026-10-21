import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * Walk the document once and number every footnoteReference node by
 * document order (1, 2, 3, …). This is the single source of truth for
 * numbering — used both by the live superscript decorations below and by
 * the bottom-of-page Notes list, so the two can never disagree.
 */
export function getFootnoteNumbers(doc: ProseMirrorNode): Map<string, number> {
  const numbers = new Map<string, number>();
  let n = 0;
  doc.descendants((node) => {
    if (node.type.name === "footnoteReference" && node.attrs.noteId) {
      n += 1;
      numbers.set(node.attrs.noteId, n);
    }
  });
  return numbers;
}

const FootnoteReference = Node.create({
  name: "footnoteReference",
  group: "inline",
  inline: true,
  atom: true, // a single, indivisible point — not editable text

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-note-id"),
        renderHTML: (attrs: { noteId?: string | null }) =>
          attrs.noteId ? { "data-note-id": attrs.noteId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "sup[data-note-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes, { class: "footnote-ref" })];
  },

  addCommands() {
    return {
      insertFootnoteReference:
        (noteId: string) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { noteId } })
            .run(),

      removeFootnoteReferences:
        (noteId: string) =>
        ({ tr, state, dispatch }) => {
          const positions: number[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === "footnoteReference" && node.attrs.noteId === noteId) {
              positions.push(pos);
            }
          });
          if (positions.length === 0) return false;
          positions
            .sort((a, b) => b - a)
            .forEach((pos) => tr.delete(pos, pos + 1));
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey("footnoteNumbering");
    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations(state) {
            const numbers = getFootnoteNumbers(state.doc);
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === "footnoteReference" && node.attrs.noteId) {
                const num = numbers.get(node.attrs.noteId);
                if (num !== undefined) {
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      "data-number": String(num),
                    })
                  );
                }
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    footnoteReference: {
      insertFootnoteReference: (noteId: string) => ReturnType;
      removeFootnoteReferences: (noteId: string) => ReturnType;
    };
  }
}

export default FootnoteReference;
