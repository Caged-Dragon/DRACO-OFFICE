export type CommentReply = {
  id: string;
  body: string;
  createdAt: string; // ISO timestamp
};

export type Comment = {
  id: string;
  /** A snapshot of the commented text, for display in the panel even if
   *  the mark itself is later stripped (e.g. by "Clear formatting"). */
  quote: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  replies: CommentReply[];
};

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older environments without crypto.randomUUID.
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createComment(quote: string, body: string): Comment {
  return {
    id: generateId(),
    quote,
    body,
    resolved: false,
    createdAt: new Date().toISOString(),
    replies: [],
  };
}

export function addReply(comment: Comment, body: string): Comment {
  return {
    ...comment,
    replies: [
      ...comment.replies,
      { id: generateId(), body, createdAt: new Date().toISOString() },
    ],
  };
}

export function setResolved(comment: Comment, resolved: boolean): Comment {
  return { ...comment, resolved };
}

export function updateComment(
  comments: Comment[],
  id: string,
  updater: (c: Comment) => Comment
): Comment[] {
  return comments.map((c) => (c.id === id ? updater(c) : c));
}

export function removeComment(comments: Comment[], id: string): Comment[] {
  return comments.filter((c) => c.id !== id);
}

export function unresolvedCount(comments: Comment[]): number {
  return comments.filter((c) => !c.resolved).length;
}

/**
 * Validate untrusted input (localStorage, a .dwdoc file, a hand-edited or
 * corrupted one) into a safe Comment[]. Never throws; drops anything
 * malformed rather than letting it crash the panel or the editor.
 */
export function sanitizeComments(input: unknown): Comment[] {
  if (!Array.isArray(input)) return [];
  const out: Comment[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== "string" || typeof c.body !== "string") continue;
    const replies: CommentReply[] = Array.isArray(c.replies)
      ? (c.replies as unknown[])
          .filter(
            (r): r is Record<string, unknown> =>
              !!r &&
              typeof r === "object" &&
              typeof (r as Record<string, unknown>).body === "string"
          )
          .map((r) => ({
            id: typeof r.id === "string" ? r.id : generateId(),
            body: r.body as string,
            createdAt:
              typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
          }))
      : [];
    out.push({
      id: c.id,
      quote: typeof c.quote === "string" ? c.quote : "",
      body: c.body,
      resolved: c.resolved === true,
      createdAt: typeof c.createdAt === "string" ? c.createdAt : new Date().toISOString(),
      replies,
    });
  }
  return out;
}
