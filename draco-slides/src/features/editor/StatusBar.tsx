export type SaveStatus = "saved" | "saving" | "error";

interface Props {
  index: number;
  slideCount: number;
  width: number;
  height: number;
  status: SaveStatus;
}

export function StatusBar({ index, slideCount, width, height, status }: Props) {
  return (
    <footer className="editor__status">
      <span>
        Slide {index + 1} of {slideCount}
      </span>
      <span className="muted">
        {width} × {height}
      </span>
      <span className={status === "error" ? "error" : "muted"} role="status">
        {status === "saved" && "Saved in this browser"}
        {status === "saving" && "Saving…"}
        {status === "error" && "Could not save. Your changes are still on screen; keep this tab open."}
      </span>
    </footer>
  );
}
