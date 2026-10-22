import { useSyncExternalStore } from "react";
import type { PointerStore } from "../canvas/pointerStore";

export type SaveStatus = "saved" | "saving" | "error";

interface Props {
  index: number;
  slideCount: number;
  width: number;
  height: number;
  zoomPercent: number;
  pointerStore: PointerStore;
  status: SaveStatus;
  /** Why the last save failed, shown with Retry and Download backup. */
  saveError: string | null;
  onRetry: () => void;
  onDownloadBackup: () => void;
}

function PointerReadout({ store }: { store: PointerStore }) {
  const p = useSyncExternalStore(store.subscribe, store.get);
  return <span className="muted">Pointer {p ? `${p.x}, ${p.y}` : "—"}</span>;
}

export function StatusBar({
  index,
  slideCount,
  width,
  height,
  zoomPercent,
  pointerStore,
  status,
  saveError,
  onRetry,
  onDownloadBackup,
}: Props) {
  return (
    <footer className="editor__status">
      <span>
        Slide {index + 1} of {slideCount}
      </span>
      <span className="muted">
        {width} × {height}
      </span>
      <PointerReadout store={pointerStore} />
      <span className="muted">Zoom {zoomPercent}%</span>
      <span className="editor__save">
        <span className={status === "error" ? "error" : "muted"} role="status">
          {status === "saved" && "Saved in this browser"}
          {status === "saving" && "Saving…"}
          {status === "error" && `Could not save. ${saveError ?? ""} Your changes are still on screen.`}
        </span>
        {status === "error" && (
          <>
            <button className="btn btn--small" onClick={onRetry}>
              Retry
            </button>
            <button className="btn btn--small" onClick={onDownloadBackup}>
              Download backup
            </button>
          </>
        )}
      </span>
    </footer>
  );
}
