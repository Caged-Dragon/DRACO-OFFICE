export const SLIDE_SIZES = {
  "16:9": { label: "Widescreen (16:9)", width: 960, height: 540 },
  "4:3": { label: "Standard (4:3)", width: 960, height: 720 },
  "16:10": { label: "Widescreen (16:10)", width: 960, height: 600 },
} as const;

export type SlideSizeId = keyof typeof SLIDE_SIZES;
export const DEFAULT_SLIDE_SIZE: SlideSizeId = "16:9";
export const SLIDE_SIZE_IDS = Object.keys(SLIDE_SIZES) as SlideSizeId[];
