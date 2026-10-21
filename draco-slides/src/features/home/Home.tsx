import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Presentation } from "../../core/document-model/types";
import { SLIDE_SIZE_IDS, SLIDE_SIZES, DEFAULT_SLIDE_SIZE, type SlideSizeId } from "../../core/document-model/sizes";
import { deletePresentation, listPresentations } from "../../services/storage/presentationStore";

interface Props {
  onNew: (title: string, size: SlideSizeId) => void;
  onOpen: (id: string) => void;
}

export function Home({ onNew, onOpen }: Props) {
  const [recent, setRecent] = useState<Presentation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<SlideSizeId>(DEFAULT_SLIDE_SIZE);
  const [query, setQuery] = useState("");

  const refresh = () =>
    listPresentations()
      .then(setRecent)
      .catch(() => setLoadError("Saved presentations could not be read from this browser."));

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (recent ?? []).filter((p) => !q || p.title.toLowerCase().includes(q));
  }, [recent, query]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onNew(title.trim(), size);
  };

  return (
    <div className="home">
      <h1>Your presentations</h1>

      <form className="newrow" onSubmit={submit}>
        <label className="field">
          <span className="muted">Title (optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled presentation" />
        </label>
        <label className="field">
          <span className="muted">Slide size</span>
          <select value={size} onChange={(e) => setSize(e.target.value as SlideSizeId)}>
            {SLIDE_SIZE_IDS.map((id) => (
              <option key={id} value={id}>
                {SLIDE_SIZES[id].label} · {SLIDE_SIZES[id].width} × {SLIDE_SIZES[id].height}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn--primary">
          New presentation
        </button>
      </form>

      {loadError && <p role="alert" className="error">{loadError}</p>}

      <section aria-labelledby="recent-h">
        <h2 id="recent-h">Recent presentations</h2>
        {recent === null ? (
          <p className="muted">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="muted">Nothing saved yet. Create a presentation to get started.</p>
        ) : (
          <>
            <label className="field">
              <span className="muted">Search recent presentations</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            {visible.length === 0 ? (
              <p className="muted">No presentations match “{query}”.</p>
            ) : (
              <ul className="recent">
                {visible.map((p) => (
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
          </>
        )}
      </section>
    </div>
  );
}
