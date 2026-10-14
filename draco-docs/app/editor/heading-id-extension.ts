import Heading from "@tiptap/extension-heading";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export type HeadingEntry = { id: string; level: number; text: string };

function generateHeadingId(): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `heading-${raw}`;
}

/**
 * Walk the document once and list every heading with an id, in document
 * order. Pure and framework-free, same pattern as getFootnoteNumbers and
 * listChanges — the single source of truth the TOC panel reads from.
 */
export function getHeadings(doc: ProseMirrorNode): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  doc.descendants((node) => {
    if (node.type.name === "heading" && node.attrs.id) {
      headings.push({
        id: node.attrs.id,
        level: node.attrs.level,
        text: node.textContent,
      });
    }
  });
  return headings;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    headingId: {
      ensureHeadingIds: () => ReturnType;
    };
  }
}

const headingIdPluginKey = new PluginKey("headingIds");

/**
 * Shared by both the ongoing appendTransaction hook (for edits after the
 * editor has mounted) and the explicit ensureHeadingIds command (for the
 * document the editor STARTS with — appendTransaction never runs for
 * initial content, since that doc is constructed directly, not applied as
 * a dispatched transaction, so without this a freshly opened file would
 * show an empty TOC until the first edit).
 */
function assignMissingHeadingIds(
  doc: ProseMirrorNode,
  tr: { setNodeMarkup: (pos: number, type: undefined, attrs: Record<string, unknown>) => unknown }
): boolean {
  let changed = false;
  const usedIds = new Set<string>();
  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const id = node.attrs.id as string | null;
    if (id && !usedIds.has(id)) {
      usedIds.add(id);
      return;
    }
    const freshId = generateHeadingId();
    usedIds.add(freshId);
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: freshId });
    changed = true;
  });
  return changed;
}

/**
 * StarterKit bundles its own Heading; to add an `id` attribute we disable
 * that one (StarterKit.configure({ heading: false })) and register this
 * extended version instead — same approach as the Link fix in v19.
 */
const HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("id"),
        renderHTML: (attrs: { id?: string | null }) =>
          attrs.id ? { id: attrs.id } : {},
      },
    };
  },

  addCommands() {
    return {
      // Spread the parent's commands (setHeading, toggleHeading) — without
      // this, overriding addCommands() REPLACES rather than merges, the
      // same gotcha addAttributes above already guards against.
      ...this.parent?.(),
      // Call once from onCreate to cover the document the editor STARTS
      // with (see assignMissingHeadingIds's comment for why that's needed
      // in addition to the appendTransaction hook below).
      ensureHeadingIds:
        () =>
        ({ tr, dispatch }) => {
          const changed = assignMissingHeadingIds(tr.doc, tr);
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    };
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];
    return [
      ...parentPlugins,
      new Plugin({
        key: headingIdPluginKey,
        // Assigns a stable id to any heading that doesn't have one yet
        // (newly typed, or pasted from elsewhere), and reassigns a fresh
        // id to any heading whose id collides with an earlier one in the
        // same document (e.g. a heading copy-pasted within the doc).
        // Attribute-only changes (setNodeMarkup) never shift positions,
        // so the positions captured during the scan stay valid across
        // every call in the loop — no reverse-order processing needed,
        // unlike range-deleting operations elsewhere in this app.
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((t) => t.docChanged)) return null;
          const tr = newState.tr;
          return assignMissingHeadingIds(newState.doc, tr) ? tr : null;
        },
      }),
    ];
  },
});

export default HeadingWithId;
