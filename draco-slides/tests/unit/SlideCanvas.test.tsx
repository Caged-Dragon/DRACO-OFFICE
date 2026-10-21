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
    const title = screen.getByText("Visible title");
    expect(title).toHaveStyle({ transform: "rotate(15deg)" });
    expect(screen.queryByText("Secret body")).not.toBeInTheDocument();
  });

  it("scales height from the presentation's aspect ratio", () => {
    const p = createPresentation("4:3", { size: "4:3" });
    render(<SlideCanvas presentation={p} slide={p.slides[0]} displayWidth={480} />);
    expect(screen.getByRole("img")).toHaveStyle({ width: "480px", height: "360px" });
  });
});
