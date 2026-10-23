import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import { SlideCanvas } from "../../src/features/editor/SlideCanvas";

describe("SlideCanvas", () => {
  it("does not render hidden objects and applies rotation", () => {
    const p = createPresentation("Canvas");
    const slide = p.slides[0];
    slide.objects[0].text = "Visible title";
    slide.objects[1].text = "Secret body";
    slide.objects[1].visible = false;
    slide.objects[0].rotation = 15;
    render(<SlideCanvas presentation={p} slide={slide} displayWidth={480} />);
    const title = screen.getByText("Visible title").closest(".slide__text") as HTMLElement;
    expect(title).toHaveStyle({ transform: "rotate(15deg)" });
    expect(screen.queryByText("Secret body")).not.toBeInTheDocument();
  });

  it("scales height from the presentation's aspect ratio", () => {
    const p = createPresentation("4:3", { size: "4:3" });
    render(<SlideCanvas presentation={p} slide={p.slides[0]} displayWidth={480} />);
    expect(screen.getByRole("img")).toHaveStyle({ width: "480px", height: "360px" });
  });

  it("renders each line as its own block, keeping empty lines", () => {
    const p = createPresentation("Lines");
    p.slides[0].objects[0].text = "a\n\nb";
    const { container } = render(<SlideCanvas presentation={p} slide={p.slides[0]} displayWidth={480} />);
    const lines = [...container.querySelectorAll(".slide__text--title .rt-line")];
    expect(lines.map((l) => l.textContent)).toEqual(["a", "", "b"]);
    expect(lines[1].querySelector("br")).not.toBeNull();
  });

  it("hides the object that is being edited in place", () => {
    const p = createPresentation("Edit");
    const slide = p.slides[0];
    slide.objects[0].text = "Being edited";
    render(<SlideCanvas presentation={p} slide={slide} displayWidth={480} hideObjectId={slide.objects[0].id} />);
    const el = screen.getByText("Being edited").closest(".slide__text") as HTMLElement;
    expect(el.style.visibility).toBe("hidden");
  });
});
