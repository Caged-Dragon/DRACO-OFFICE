export type ChangeSummary = {
  changeId: string;
  author: string;
  createdAt: string;
  insertedText: string;
  deletedText: string;
};

type MarkLike = {
  type: { name: string };
  attrs: { changeId?: string | null; author?: string; createdAt?: string };
};
type TextNodeLike = {
  isText: boolean;
  text?: string;
  marks: readonly MarkLike[];
};
type DocLike = { descendants: (fn: (node: TextNodeLike) => void) => void };

/**
 * Walk the document once and group insertion/deletion marked text runs by
 * changeId. Pure and framework-free, like comments.ts — takes a doc-like
 * object so it's testable without constructing a real ProseMirror editor.
 */
export function listChanges(doc: DocLike): ChangeSummary[] {
  const byId = new Map<string, ChangeSummary>();

  doc.descendants((node) => {
    if (!node.isText || !node.text) return;
    for (const mark of node.marks) {
      if (mark.type.name !== "insertion" && mark.type.name !== "deletion") continue;
      const id = mark.attrs.changeId;
      if (!id) continue;
      let entry = byId.get(id);
      if (!entry) {
        entry = {
          changeId: id,
          author: mark.attrs.author ?? "You",
          createdAt: mark.attrs.createdAt ?? "",
          insertedText: "",
          deletedText: "",
        };
        byId.set(id, entry);
      }
      if (mark.type.name === "insertion") entry.insertedText += node.text;
      else entry.deletedText += node.text;
    }
  });

  return Array.from(byId.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  );
}
