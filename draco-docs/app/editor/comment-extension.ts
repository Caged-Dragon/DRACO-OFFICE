import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      setComment: (commentId: string) => ReturnType;
      unsetComment: () => ReturnType;
      /** Remove the comment mark for one specific id, leaving others (and
       *  the text itself) untouched — plain unsetMark("comment") would
       *  strip every comment mark in the selection, not just one. */
      removeCommentById: (commentId: string) => ReturnType;
      /** Update the resolved flag on every mark instance for a comment id,
       *  so the CSS-visible highlight can distinguish resolved from open
       *  comments without the mark's own text ever changing. */
      setCommentResolvedById: (commentId: string, resolved: boolean) => ReturnType;
    };
  }
}

const CommentMark = Mark.create({
  name: "comment",

  // Comments must not merge across separately-created ranges, or two
  // adjacent comments would visually and structurally fuse into one.
  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes) => {
          if (!attributes.commentId) return {};
          return { "data-comment-id": attributes.commentId };
        },
      },
      resolved: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-resolved") === "true",
        renderHTML: (attributes) => ({
          "data-resolved": attributes.resolved ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "comment-mark" }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),

      unsetComment:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),

      removeCommentById:
        (commentId: string) =>
        ({ tr, state, dispatch }) => {
          let found = false;
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            const mark = node.marks.find(
              (m) => m.type.name === "comment" && m.attrs.commentId === commentId
            );
            if (mark) {
              found = true;
              tr.removeMark(pos, pos + node.nodeSize, mark.type);
            }
          });
          if (found && dispatch) dispatch(tr);
          return found;
        },

      setCommentResolvedById:
        (commentId: string, resolved: boolean) =>
        ({ tr, state, dispatch }) => {
          let found = false;
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            const mark = node.marks.find(
              (m) => m.type.name === "comment" && m.attrs.commentId === commentId
            );
            if (mark) {
              found = true;
              // Marks are immutable; re-add the same type with updated
              // attrs at this range. Same-type marks exclude each other by
              // default, so this replaces rather than stacking.
              tr.removeMark(pos, pos + node.nodeSize, mark.type);
              tr.addMark(
                pos,
                pos + node.nodeSize,
                mark.type.create({ commentId, resolved })
              );
            }
          });
          if (found && dispatch) dispatch(tr);
          return found;
        },
    };
  },
});

export default CommentMark;
