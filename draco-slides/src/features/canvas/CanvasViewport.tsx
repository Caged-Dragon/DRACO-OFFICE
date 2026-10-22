import { useId, useState } from "react";
import type { Slide } from "../../core/document-model/types";
import type { Point } from "../../core/geometry/viewport";
import { SlideCanvas } from "../editor/SlideCanvas";
import type { CanvasView } from "./useCanvasView";

interface Props {
  canvas: CanvasView;
  slide: Slide;
  width: number;
  height: number;
  onPointer: (p: Point | null) => void;
}

const PAN_STEP = 40;

export function CanvasViewport({ canvas, slide, width, height, onPointer }: Props) {
  const [spaceDown, setSpaceDown] = useState(false);
  const helpId = useId();
  const { view } = canvas;

  return (
    <div
      ref={canvas.containerRef}
      className={`viewport${spaceDown ? " viewport--pan" : ""}${canvas.panning ? " viewport--panning" : ""}`}
      role="group"
      aria-label="Slide canvas"
      aria-describedby={helpId}
      tabIndex={0}
      onMouseDown={(e) => {
        // Middle button, or Space + left button, pans. Plain left clicks are kept for object selection later.
        if (e.button === 1 || (e.button === 0 && spaceDown)) {
          e.preventDefault();
          canvas.startPan({ x: e.clientX, y: e.clientY });
        }
      }}
      onMouseMove={(e) => onPointer(canvas.toSlide(e.clientX, e.clientY))}
      onMouseLeave={() => onPointer(null)}
      onKeyDown={(e) => {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        const step = e.shiftKey ? PAN_STEP * 5 : PAN_STEP;
        switch (e.key) {
          case " ":
            e.preventDefault();
            setSpaceDown(true);
            break;
          case "+":
          case "=":
            e.preventDefault();
            canvas.zoomIn();
            break;
          case "-":
          case "_":
            e.preventDefault();
            canvas.zoomOut();
            break;
          case "0":
            e.preventDefault();
            canvas.zoomFit();
            break;
          case "ArrowLeft":
            e.preventDefault();
            canvas.panBy(step, 0);
            break;
          case "ArrowRight":
            e.preventDefault();
            canvas.panBy(-step, 0);
            break;
          case "ArrowUp":
            e.preventDefault();
            canvas.panBy(0, step);
            break;
          case "ArrowDown":
            e.preventDefault();
            canvas.panBy(0, -step);
            break;
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " ") setSpaceDown(false);
      }}
      onBlur={() => setSpaceDown(false)}
    >
      <span id={helpId} className="sr-only">
        Plus and minus zoom, 0 fits the window, arrow keys pan, hold Space and drag to pan.
      </span>
      <div className="viewport__slide" style={{ left: view.panX, top: view.panY }}>
        <SlideCanvas presentation={{ width, height }} slide={slide} displayWidth={width * view.zoom} clip={false} />
      </div>
    </div>
  );
}
