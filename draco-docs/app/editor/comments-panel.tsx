"use client";

import { useState } from "react";
import type { Comment } from "./comments";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function CommentCard({
  comment,
  onReply,
  onToggleResolved,
  onDelete,
}: {
  comment: Comment;
  onReply: (body: string) => void;
  onToggleResolved: () => void;
  onDelete: () => void;
}) {
  const [replyText, setReplyText] = useState("");

  const submitReply = () => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    onReply(trimmed);
    setReplyText("");
  };

  return (
    <li
      className={`rounded-md border p-2 text-xs ${
        comment.resolved
          ? "border-slate-800 bg-slate-900/50 opacity-60"
          : "border-slate-700 bg-slate-900"
      }`}
    >
      {comment.quote && (
        <div className="mb-1 border-l-2 border-slate-600 pl-2 text-slate-400 italic line-clamp-2">
          “{comment.quote}”
        </div>
      )}
      <p className="text-slate-200">{comment.body}</p>
      <div className="mt-1 text-xs text-slate-400">
        {formatTime(comment.createdAt)}
        {comment.resolved && " · Resolved"}
      </div>

      {comment.replies.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-l border-slate-800 pl-2">
          {comment.replies.map((r) => (
            <li key={r.id}>
              <p className="text-slate-300">{r.body}</p>
              <div className="text-xs text-slate-400">
                {formatTime(r.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-center gap-1">
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitReply();
          }}
          placeholder="Reply…"
          aria-label={`Reply to comment: ${comment.body}`}
          className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
        />
        <button
          type="button"
          onClick={submitReply}
          className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap"
        >
          Reply
        </button>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleResolved}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          {comment.resolved ? "Reopen" : "Resolve"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-slate-400 hover:text-red-400"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export default function CommentsPanel({
  comments,
  onReply,
  onToggleResolved,
  onDelete,
}: {
  comments: Comment[];
  onReply: (id: string, body: string) => void;
  onToggleResolved: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside
      aria-label="Comments"
      className="w-72 shrink-0 border-l border-slate-800 bg-slate-950 overflow-y-auto p-3"
    >
      <h2 className="text-xs font-semibold text-slate-300 mb-2">
        Comments{comments.length > 0 && ` (${comments.length})`}
      </h2>
      {comments.length === 0 ? (
        <p className="text-xs text-slate-400">
          Select text and click “Add comment” to start a discussion.
        </p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              onReply={(body) => onReply(c.id, body)}
              onToggleResolved={() => onToggleResolved(c.id)}
              onDelete={() => onDelete(c.id)}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}
