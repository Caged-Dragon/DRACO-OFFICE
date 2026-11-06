import { describe, expect, it } from "vitest";
import { rulerStep, rulerTicks } from "../../src/core/geometry/ruler";

describe("rulerStep", () => {
  it("picks the smallest 1-2-5 step with labels at least 50 screen pixels apart", () => {
    expect(rulerStep(1)).toBe(50);
    expect(rulerStep(0.5)).toBe(100);
    expect(rulerStep(4)).toBe(20);
    expect(rulerStep(0.1)).toBe(500);
    expect(rulerStep(100)).toBe(1);
    expect(rulerStep(0.0001)).toBe(20000); // capped
  });
});

describe("rulerTicks", () => {
  const majors = (t: ReturnType<typeof rulerTicks>) => t.filter((x) => x.major);

  it("has major labels every step and minor ticks between them", () => {
    const ticks = rulerTicks({ pan: 0, zoom: 1, length: 120 });
    expect(ticks.map((t) => t.value)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
    expect(majors(ticks).map((t) => t.label)).toEqual(["0", "50", "100"]);
    expect(ticks.filter((t) => !t.major).every((t) => t.label === null)).toBe(true);
  });

  it("starts where the visible part of the slide starts when the view is panned", () => {
    const ticks = rulerTicks({ pan: -80, zoom: 1, length: 200 });
    expect(ticks[0].value).toBe(80);
    expect(ticks[0].position).toBe(0);
    expect(majors(ticks).map((t) => [t.label, t.position])).toEqual([
      ["100", 20],
      ["150", 70],
      ["200", 120],
      ["250", 170],
    ]);
  });

  it("labels the area before the slide with negative numbers", () => {
    const ticks = rulerTicks({ pan: 100, zoom: 1, length: 150 });
    expect(majors(ticks).map((t) => t.label)).toEqual(["-100", "-50", "0", "50"]);
    expect(ticks.find((t) => t.value === 0)?.position).toBe(100);
  });

  it("subdivides sensibly when zoomed in and out", () => {
    const zoomedIn = rulerTicks({ pan: 0, zoom: 4, length: 200 });
    expect(majors(zoomedIn).map((t) => t.label)).toEqual(["0", "20", "40"]);
    expect(zoomedIn.map((t) => t.value)).toEqual([0, 10, 20, 30, 40, 50]);
    const zoomedOut = rulerTicks({ pan: 0, zoom: 0.1, length: 300 });
    expect(majors(zoomedOut).map((t) => t.label)).toEqual(["0", "500", "1000", "1500", "2000", "2500", "3000"]);
  });

  it("never produces more than a bounded number of ticks, all inside the ruler", () => {
    const ticks = rulerTicks({ pan: 0, zoom: 0.1, length: 5000 });
    expect(ticks.length).toBeLessThanOrEqual(1001);
    expect(ticks.every((t) => t.position >= -1 && t.position <= 5001)).toBe(true);
  });
});
