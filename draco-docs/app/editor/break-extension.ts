import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
    sectionBreak: {
      insertSectionBreak: () => ReturnType;
    };
  }
}

/**
 * A block-level, content-less marker. Inserting it at a position inside a
 * paragraph splits that paragraph in two around it — ordinary ProseMirror
 * block-insertion behavior, verified in testing rather than assumed.
 */
const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-break="page"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-break": "page", class: "doc-break doc-break-page" }),
    ];
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name }).run(),
    };
  },
});

const SectionBreak = Node.create({
  name: "sectionBreak",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-break="section"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-break": "section",
        class: "doc-break doc-break-section",
      }),
    ];
  },

  addCommands() {
    return {
      insertSectionBreak:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name }).run(),
    };
  },
});

export { PageBreak, SectionBreak };
