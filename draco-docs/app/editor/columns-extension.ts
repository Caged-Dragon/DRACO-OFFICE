import { Node, mergeAttributes } from "@tiptap/core";
import { liftTarget } from "@tiptap/pm/transform";

export type ColumnCount = 2 | 3;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columnsBlock: {
      setColumns: (count: ColumnCount) => ReturnType;
      unsetColumns: () => ReturnType;
    };
  }
}

/**
 * Wraps selected block content so it flows as real CSS multi-column text —
 * functional, not a visual placeholder like v26's breaks. Content inside
 * reflows between columns exactly like a newspaper layout.
 */
const ColumnsBlock = Node.create({
  name: "columnsBlock",
  group: "block",
  content: "block+",

  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (el: HTMLElement) => {
          const parsed = parseInt(el.getAttribute("data-columns") ?? "2", 10);
          return parsed === 3 ? 3 : 2;
        },
        renderHTML: (attrs: { count?: ColumnCount }) => ({
          "data-columns": String(attrs.count ?? 2),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-columns]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "doc-columns",
        style: `columns: ${node.attrs.count};`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setColumns:
        (count: ColumnCount) =>
        ({ state, commands, chain }) => {
          const { $from } = state.selection;
          // Already inside a columnsBlock — just change its column count,
          // don't re-wrap (that would nest wrappers pointlessly).
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === "columnsBlock") {
              return commands.updateAttributes("columnsBlock", { count });
            }
          }
          // Not inside one yet — wrap the current selection's blocks.
          return chain().wrapIn("columnsBlock", { count }).run();
        },

      unsetColumns:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === "columnsBlock") {
              // The chain()/setTextSelection()/lift("columnsBlock") command
              // approach only lifts content around wherever the cursor
              // happens to be — a cursor in just one paragraph would strand
              // the rest inside the wrapper. blockRange + liftTarget is
              // ProseMirror's own idiomatic way to lift an entire wrapped
              // range out of its parent in one step, and avoids a spurious
              // "TextSelection endpoint not pointing into a node with
              // inline content" console warning the selection-based
              // approach triggered in testing.
              const blockStart = $from.before(depth);
              const blockNode = $from.node(depth);
              const $innerFrom = tr.doc.resolve(blockStart + 1);
              const $innerTo = tr.doc.resolve(
                blockStart + blockNode.nodeSize - 1
              );
              const range = $innerFrom.blockRange($innerTo);
              if (!range) return false;
              const target = liftTarget(range);
              if (target === null || target === undefined) return false;
              tr.lift(range, target);
              if (dispatch) dispatch(tr);
              return true;
            }
          }
          return false;
        },
    };
  },
});

export default ColumnsBlock;
