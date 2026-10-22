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
}

function PointerReadout({ store }: { store: PointerStore }) {
  const p = useSyncExternalStore(store.subscribe, store.get);
  return <span className="muted">Pointer {p ? `${p.x}, ${p.y}` : "—"}</span>;
}

export function StatusBar({ index, slideCount, width, height, zoomPercent, pointerStore, status }: Props) {
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
      <span className={status === "error" ? "error" : "muted"} role="status">
        {status === "saved" && "Saved in this browser"}
        {status === "saving" && "Saving…"}
        {status === "error" && "Could not save. Your changes are still on screen; keep this tab open."}
      </span>
    </footer>
  );
}
