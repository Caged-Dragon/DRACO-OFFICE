import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  centeredView,
  clampPan,
  clampZoom,
  fitView,
  nextZoomStep,
  screenToSlide,
  slideToScreen,
  zoomAt,
} from "../../src/core/geometry/viewport";

const slide = { width: 960, height: 540 };

describe("viewport geometry", () => {
  it("clamps zoom and tolerates bad numbers", () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("fits the slide inside the viewport with padding, centered", () => {
    const v = fitView({ width: 1000, height: 700 }, slide, 32);
    expect(v.zoom).toBeCloseTo(936 / 960, 6); // width is the limiting side
    expect(v.panX).toBeCloseTo(32, 6);
    expect(v.panY).toBeCloseTo((700 - 540 * v.zoom) / 2, 6);
  });

  it("fit never produces a zero or negative zoom for tiny viewports", () => {
    const v = fitView({ width: 10, height: 10 }, slide);
    expect(v.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
  });

  it("screen and slide coordinates round-trip", () => {
    const view = { zoom: 1.7, panX: -120, panY: 33 };
    const p = { x: 250, y: 410 };
    const back = screenToSlide(slideToScreen(p, view), view);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
    expect(screenToSlide({ x: view.panX, y: view.panY }, view)).toEqual({ x: 0, y: 0 });
  });

  it("zoomAt keeps the slide point under the anchor fixed", () => {
    const view = centeredView({ width: 800, height: 500 }, slide, 0.8);
    const anchor = { x: 300, y: 200 };
    const before = screenToSlide(anchor, view);
    const zoomed = zoomAt(view, 2.5, anchor);
    const after = screenToSlide(anchor, zoomed);
    expect(zoomed.zoom).toBe(2.5);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it("zoomAt respects the zoom limits", () => {
    const view = { zoom: 1, panX: 0, panY: 0 };
    expect(zoomAt(view, 100, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(view, 0.001, { x: 0, y: 0 }).zoom).toBe(MIN_ZOOM);
  });

  it("clampPan keeps part of the slide on screen on every side", () => {
    const viewport = { width: 800, height: 500 };
    const far = clampPan({ zoom: 1, panX: -99999, panY: 99999 }, viewport, slide, 48);
    expect(far.panX).toBe(48 - 960); // only 48px of the slide's right edge remain visible
    expect(far.panY).toBe(500 - 48); // only 48px of the slide's top edge remain visible
    const ok = { zoom: 1, panX: -80, panY: -20 };
    expect(clampPan(ok, viewport, slide)).toEqual(ok);
  });

  it("steps through zoom presets in both directions and stops at the ends", () => {
    expect(nextZoomStep(0.7667, 1)).toBe(1);
    expect(nextZoomStep(1, 1)).toBe(1.25);
    expect(nextZoomStep(1, -1)).toBe(0.75);
    expect(nextZoomStep(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(nextZoomStep(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });
});
