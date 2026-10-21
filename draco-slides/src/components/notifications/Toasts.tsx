import { useEffect } from "react";
import { useApp } from "../../state/AppContext";
import type { Notice } from "../../state/appReducer";

function Toast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  // Info messages clear themselves; errors stay until dismissed so they are not missed.
  useEffect(() => {
    if (notice.kind !== "info") return;
    const t = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(t);
  }, [notice.kind, onDismiss]);

  return (
    <div className={`toast toast--${notice.kind}`}>
      <span>{notice.message}</span>
      <button className="btn btn--small" onClick={onDismiss} aria-label="Dismiss message">
        Dismiss
      </button>
    </div>
  );
}

export function Toasts() {
  const { state, dispatch } = useApp();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {state.notices.map((n) => (
        <Toast key={n.id} notice={n} onDismiss={() => dispatch({ type: "dismissNotice", id: n.id })} />
      ))}
    </div>
  );
}
