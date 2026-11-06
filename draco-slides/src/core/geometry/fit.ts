/**
 * Largest size in [min, max], in half steps, for which `fits(size)` is true. `fits` must be monotonic: if a size
 * fits, every smaller size fits too (true for text in a box). Returns `min` when nothing fits, and tells the caller
 * whether the returned size really fits.
 */
export function largestFittingSize(
  fits: (size: number) => boolean,
  min: number,
  max: number,
): { size: number; fits: boolean } {
  let lo = Math.ceil(min * 2); // in half steps
  let hi = Math.floor(max * 2);
  if (hi < lo) hi = lo;
  if (!fits(hi / 2)) {
    if (!fits(lo / 2)) return { size: lo / 2, fits: false };
  } else {
    return { size: hi / 2, fits: true };
  }
  // invariant: lo fits, hi does not
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid / 2)) lo = mid;
    else hi = mid;
  }
  return { size: lo / 2, fits: true };
}
