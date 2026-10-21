import Image from "@tiptap/extension-image";

export type ImageWrap = "none" | "left" | "right";

const WRAP_STYLES: Record<ImageWrap, string> = {
  none: "display: block; margin: 1rem auto;",
  left: "float: left; margin: 0 1rem 0.5rem 0;",
  right: "float: right; margin: 0 0 0.5rem 1rem;",
};

// TipTap's Image extension has no built-in text-wrap concept, so this adds
// a `wrap` attribute (none/left/right) rendered as inline float/margin CSS —
// same pattern as the custom indent/font-size attributes in earlier versions.
const WrappableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      wrap: {
        default: "none",
        parseHTML: (element: HTMLElement) => {
          const float = element.style.float;
          if (float === "left" || float === "right") return float;
          return "none";
        },
        renderHTML: (attributes: { wrap?: ImageWrap }) => {
          const wrap = attributes.wrap || "none";
          return { style: WRAP_STYLES[wrap] };
        },
      },
    };
  },
});

export default WrappableImage;
