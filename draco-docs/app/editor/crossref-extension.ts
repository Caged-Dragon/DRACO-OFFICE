import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { getHeadings } from "./heading-id-extension";
import { getBookmarks } from "./bookmark-extension";

export type RefTarget = { id: string; label: string };

const MISSING_LABEL = "(missing reference)";

/**
 * All the things a cross-reference can currently point at: every heading
 * (by its text) and every bookmark (by its name). Pure and framework-free.
 */
export function getRefTargets(doc: ProseMirrorNode): RefTarget[] {
  const headings = getHeadings(doc).map((h) => ({
    id: h.id,
    label: h.text || "(empty heading)",
  }));
  const bookmarks = getBookmarks(doc).map((b) => ({
    id: b.id,
    label: b.name,
  }));
  return [...headings, ...bookmarks];
}

/** Resolve one target id to its current live label, or the missing-ref
 *  placeholder if that heading/bookmark no longer exists. */
export function resolveRefLabel(doc: ProseMirrorNode, targetId: string): string {
  const target = getRefTargets(doc).find((t) => t.id === targetId);
  return target?.label ?? MISSING_LABEL;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    crossReference: {
      insertCrossReference: (targetId: string) => ReturnType;
    };
  }
}

const CrossReference = Node.create({
  name: "crossReference",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      targetId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-target-id"),
        renderHTML: (attrs: { targetId?: string | null }) =>
          attrs.targetId ? { "data-target-id": attrs.targetId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-target-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "xref" })];
  },

  addCommands() {
    return {
      insertCrossReference:
        (targetId: string) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { targetId } })
            .run(),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("crossRefLabels"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === "crossReference" && node.attrs.targetId) {
                const label = resolveRefLabel(state.doc, node.attrs.targetId);
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    "data-label": label,
                  })
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export { MISSING_LABEL };
export default CrossReference;
