import { Node, mergeAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export type BookmarkEntry = { id: string; name: string };

function generateBookmarkId(): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `bookmark-${raw}`;
}

/**
 * Walk the document once and list every bookmark in document order. Pure
 * and framework-free — same pattern as getHeadings/getFootnoteNumbers.
 */
export function getBookmarks(doc: ProseMirrorNode): BookmarkEntry[] {
  const bookmarks: BookmarkEntry[] = [];
  doc.descendants((node) => {
    if (node.type.name === "bookmark" && node.attrs.id) {
      bookmarks.push({ id: node.attrs.id, name: node.attrs.name ?? "" });
    }
  });
  return bookmarks;
}

/** Bookmark names must be unique (Word's own rule) — this appends a
 *  numeric suffix until the name is free, rather than silently colliding
 *  with an existing bookmark that a cross-reference might already target. */
export function uniqueBookmarkName(
  desired: string,
  existing: BookmarkEntry[]
): string {
  const taken = new Set(existing.map((b) => b.name));
  if (!taken.has(desired)) return desired;
  let i = 2;
  while (taken.has(`${desired} (${i})`)) i++;
  return `${desired} (${i})`;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    bookmark: {
      insertBookmark: (name: string) => ReturnType;
      removeBookmark: (id: string) => ReturnType;
    };
  }
}

const Bookmark = Node.create({
  name: "bookmark",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-bookmark-id"),
        renderHTML: (attrs: { id?: string | null }) =>
          attrs.id ? { "data-bookmark-id": attrs.id } : {},
      },
      name: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-name") ?? "",
        renderHTML: (attrs: { name?: string }) => ({
          "data-name": attrs.name ?? "",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-bookmark-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "bookmark-marker" })];
  },

  addCommands() {
    return {
      insertBookmark:
        (name: string) =>
        ({ chain, state }) => {
          const id = generateBookmarkId();
          const finalName = uniqueBookmarkName(
            name.trim() || "Bookmark",
            getBookmarks(state.doc)
          );
          return chain()
            .insertContent({ type: this.name, attrs: { id, name: finalName } })
            .run();
        },

      removeBookmark:
        (id: string) =>
        ({ tr, state, dispatch }) => {
          let pos = -1;
          state.doc.descendants((node, p) => {
            if (node.type.name === "bookmark" && node.attrs.id === id) pos = p;
          });
          if (pos === -1) return false;
          tr.delete(pos, pos + 1);
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});

export default Bookmark;
