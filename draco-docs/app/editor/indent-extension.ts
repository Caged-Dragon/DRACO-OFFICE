import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
  }
}

const MAX_INDENT_LEVEL = 8;
const INDENT_STEP_PX = 24;

const Indent = Extension.create({
  name: "indent",

  addOptions() {
    return {
      types: ["paragraph", "heading"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indentLevel: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const margin = parseInt(element.style.marginLeft || "0", 10);
              return margin > 0 ? Math.round(margin / INDENT_STEP_PX) : 0;
            },
            renderHTML: (attributes: { indentLevel?: number }) => {
              const level = attributes.indentLevel || 0;
              if (!level) return {};
              return { style: `margin-left: ${level * INDENT_STEP_PX}px` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { from, to } = selection;
          let changed = false;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const current = node.attrs.indentLevel || 0;
              if (current < MAX_INDENT_LEVEL) {
                tr.setNodeAttribute(pos, "indentLevel", current + 1);
                changed = true;
              }
            }
          });

          if (changed && dispatch) dispatch(tr);
          return changed;
        },
      decreaseIndent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { from, to } = selection;
          let changed = false;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const current = node.attrs.indentLevel || 0;
              if (current > 0) {
                tr.setNodeAttribute(pos, "indentLevel", current - 1);
                changed = true;
              }
            }
          });

          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.increaseIndent(),
      "Shift-Tab": () => this.editor.commands.decreaseIndent(),
    };
  },
});

export default Indent;
