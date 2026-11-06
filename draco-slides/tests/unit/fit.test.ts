import { describe, expect, it, vi } from "vitest";
import { largestFittingSize } from "../../src/core/geometry/fit";

/** A text of `lines` lines at line-height 1.2 fits a box of `height` when lines * size * 1.2 <= height. */
const fitsBox = (lines: number, height: number) => (size: number) => lines * size * 1.2 <= height;

describe("largestFittingSize", () => {
  it("finds the largest half-step size that fits", () => {
    expect(largestFittingSize(fitsBox(5, 100), 6, 24)).toEqual({ size: 16.5, fits: true }); // 5*16.5*1.2 = 99
    expect(largestFittingSize(fitsBox(1, 100), 6, 400)).toEqual({ size: 83, fits: true }); // 83*1.2 = 99.6
  });

  it("returns the maximum when it already fits", () => {
    const fits = vi.fn(fitsBox(1, 1000));
    expect(largestFittingSize(fits, 6, 24)).toEqual({ size: 24, fits: true });
    expect(fits).toHaveBeenCalledTimes(1);
  });

  it("returns the minimum and says so when nothing fits", () => {
    expect(largestFittingSize(fitsBox(100, 10), 6, 24)).toEqual({ size: 6, fits: false });
  });

  it("returns the minimum when only the minimum fits", () => {
    expect(largestFittingSize(fitsBox(10, 73), 6, 24)).toEqual({ size: 6, fits: true }); // 10*6*1.2 = 72
  });

  it("copes with min above max and half-step bounds", () => {
    expect(largestFittingSize(() => true, 10, 8).size).toBe(10);
    expect(largestFittingSize(fitsBox(1, 20), 6.5, 30.5)).toEqual({ size: 16.5, fits: true }); // 16.5*1.2 = 19.8
  });

  it("needs only a logarithmic number of measurements", () => {
    const fits = vi.fn(fitsBox(1, 100));
    largestFittingSize(fits, 6, 400);
    expect(fits.mock.calls.length).toBeLessThanOrEqual(14);
  });

  it("every returned size really fits (when fits is true) and the next half step does not", () => {
    for (const lines of [1, 2, 3, 7, 12]) {
      for (const height of [50, 120, 333]) {
        const fits = fitsBox(lines, height);
        const r = largestFittingSize(fits, 6, 400);
        if (r.fits) {
          expect(fits(r.size)).toBe(true);
          if (r.size < 400) expect(fits(r.size + 0.5)).toBe(false);
        } else {
          expect(fits(6)).toBe(false);
        }
      }
    }
  });
});
