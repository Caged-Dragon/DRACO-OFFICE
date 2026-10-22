import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  clampPan,
  clampZoom,
  fitView,
  nextZoomStep,
  screenToSlide,
  zoomAt,
  type Point,
  type Size,
  type View,
} from "../../core/geometry/viewport";

/** Used until the viewport has been measured (and in test environments without layout). */
const FALLBACK_VIEWPORT: Size = { width: 800, height: 500 };

export function useCanvasView(slideWidth: number, slideHeight: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Size>({ width: 0, height: 0 });
  /** null = "fit to window": the view follows the viewport size. */
  const [manual, setManual] = useState<View | null>(null);
  const [panning, setPanning] = useState(false);

  const viewport = measured.width > 0 && measured.height > 0 ? measured : FALLBACK_VIEWPORT;
  const slide = useMemo<Size>(() => ({ width: slideWidth, height: slideHeight }), [slideWidth, slideHeight]);
  const fit = useMemo(() => fitView(viewport, slide), [viewport, slide]);
  const view = manual ? clampPan(manual, viewport, slide) : fit;

  const viewRef = useRef(view);
  const viewportRef = useRef(viewport);
  const slideRef = useRef(slide);
  viewRef.current = view;
  viewportRef.current = viewport;
  slideRef.current = slide;

  const dragCleanup = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () =>
      setMeasured((prev) =>
        prev.width === el.clientWidth && prev.height === el.clientHeight
          ? prev
          : { width: el.clientWidth, height: el.clientHeight },
      );
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const apply = useCallback((next: View) => {
    setManual(clampPan({ ...next, zoom: clampZoom(next.zoom) }, viewportRef.current, slideRef.current));
  }, []);

  const center = useCallback(
    (): Point => ({ x: viewportRef.current.width / 2, y: viewportRef.current.height / 2 }),
    [],
  );

  const zoomIn = useCallback(() => apply(zoomAt(viewRef.current, nextZoomStep(viewRef.current.zoom, 1), center())), [apply, center]);
  const zoomOut = useCallback(() => apply(zoomAt(viewRef.current, nextZoomStep(viewRef.current.zoom, -1), center())), [apply, center]);
  const zoomActual = useCallback(() => apply(zoomAt(viewRef.current, 1, center())), [apply, center]);
  const zoomFit = useCallback(() => setManual(null), []);
  const zoomBy = useCallback(
    (factor: number, anchor: Point) => apply(zoomAt(viewRef.current, viewRef.current.zoom * factor, anchor)),
    [apply],
  );
  const panBy = useCallback(
    (dx: number, dy: number) => apply({ ...viewRef.current, panX: viewRef.current.panX + dx, panY: viewRef.current.panY + dy }),
    [apply],
  );

  const toSlide = useCallback((clientX: number, clientY: number): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    return screenToSlide({ x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) }, viewRef.current);
  }, []);

  const startPan = useCallback(
    (start: Point) => {
      dragCleanup.current?.();
      const origin = viewRef.current;
      const move = (e: MouseEvent) =>
        apply({ ...origin, panX: origin.panX + e.clientX - start.x, panY: origin.panY + e.clientY - start.y });
      const stop = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", stop);
        dragCleanup.current = null;
        setPanning(false);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", stop);
      dragCleanup.current = stop;
      setPanning(true);
    },
    [apply],
  );

  // Wheel: Ctrl/Cmd+wheel (also trackpad pinch) zooms at the cursor; plain wheel pans.
  // Needs a non-passive native listener so the browser's own page zoom/scroll can be prevented.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        zoomBy(Math.exp(-e.deltaY * 0.002), { x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else if (e.shiftKey && e.deltaX === 0) {
        panBy(-e.deltaY, 0);
      } else {
        panBy(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy, panBy]);

  useEffect(() => () => dragCleanup.current?.(), []);

  return {
    containerRef,
    view,
    panning,
    percent: Math.round(view.zoom * 100),
    zoomIn,
    zoomOut,
    zoomFit,
    zoomActual,
    panBy,
    toSlide,
    startPan,
  };
}

export type CanvasView = ReturnType<typeof useCanvasView>;
