import { useEffect, useState } from "react";
import type { Presentation } from "../../core/document-model/types";
import { deletePresentation, listPresentations } from "../../services/storage/presentationStore";

interface Props {
  onNew: () => void;
  onOpen: (id: string) => void;
}

export function Home({ onNew, onOpen }: Props) {
  const [recent, setRecent] = useState<Presentation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = () =>
    listPresentations()
      .then(setRecent)
      .catch(() => setLoadError("Saved presentations could not be read from this browser."));

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="home">
      <h1>Your presentations</h1>

      <button className="btn btn--primary" onClick={onNew}>
        New presentation
      </button>

      {loadError && <p role="alert" className="error">{loadError}</p>}

      <section aria-labelledby="recent-h">
        <h2 id="recent-h">Recent presentations</h2>
        {recent === null ? (
          <p className="muted">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="muted">Nothing saved yet. Create a presentation to get started.</p>
        ) : (
          <ul className="recent">
            {recent.map((p) => (
              <li key={p.id}>
                <button className="recent__open" onClick={() => onOpen(p.id)}>
                  <strong>{p.title}</strong>
                  <span className="muted">
                    {p.slides.length} slide{p.slides.length === 1 ? "" : "s"} · edited{" "}
                    {new Date(p.updatedAt).toLocaleString()}
                  </span>
                </button>
                <button
                  className="btn"
                  aria-label={`Delete ${p.title}`}
                  onClick={async () => {
                    if (window.confirm(`Delete "${p.title}" from this browser? This cannot be undone.`)) {
                      await deletePresentation(p.id);
                      void refresh();
                    }
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
