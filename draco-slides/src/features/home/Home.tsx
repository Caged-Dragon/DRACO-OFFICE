import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { SLIDE_SIZE_IDS, SLIDE_SIZES, type SlideSizeId } from "../../core/document-model/sizes";
import type { Presentation } from "../../core/document-model/types";
import { FILE_EXTENSION } from "../../core/serialization/serialize";
import { deletePresentation, listPresentationsDetailed } from "../../services/storage/presentationStore";
import { useSettings } from "../../state/SettingsContext";
import { describeStorageError } from "../../services/storage/storageError";

interface Props {
  onNew: (title: string, size: SlideSizeId) => void;
  onOpen: (id: string) => void;
  onImportFile: (file: File) => void;
}

export function Home({ onNew, onOpen, onImportFile }: Props) {
  const [recent, setRecent] = useState<Presentation[] | null>(null);
  const [unreadable, setUnreadable] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const { settings } = useSettings();
  const [size, setSize] = useState<SlideSizeId>(settings.defaultSlideSize);
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () =>
    listPresentationsDetailed()
      .then((r) => {
        setRecent(r.presentations);
        setUnreadable(r.unreadable);
        setLoadError(null);
      })
      .catch((e) => {
        setRecent([]);
        setLoadError(`Saved presentations could not be read from this browser. ${describeStorageError(e)}`);
      });

  useEffect(() => {
    void refresh();
  }, []);

  // A changed default in Settings applies to the next new presentation.
  useEffect(() => {
    setSize(settings.defaultSlideSize);
  }, [settings.defaultSlideSize]);

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
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          Open from file
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept={`${FILE_EXTENSION},.json,application/json`}
          aria-label="Presentation file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // allow choosing the same file again
            if (file) onImportFile(file);
          }}
        />
      </form>

      {loadError && <p role="alert" className="error">{loadError}</p>}
      {unreadable > 0 && (
        <p className="muted" role="note">
          {unreadable} saved item{unreadable === 1 ? "" : "s"} in this browser could not be read. They were kept, not deleted.
        </p>
      )}

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
