import { memo } from "react";
import type { Slide } from "../../core/document-model/types";
import { SlideCanvas } from "./SlideCanvas";

interface Props {
  slide: Slide;
  width: number;
  height: number;
  displayWidth: number;
}

/**
 * Thumbnail of one slide. Memoized on primitive props and the slide object itself, so editing
 * one slide does not re-render the thumbnails of the others (the reducer keeps untouched slides' references).
 */
export const SlideThumbnail = memo(function SlideThumbnail({ slide, width, height, displayWidth }: Props) {
  return <SlideCanvas presentation={{ width, height }} slide={slide} displayWidth={displayWidth} />;
});
