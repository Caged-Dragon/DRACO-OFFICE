import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createPresentation, createShape } from "../../src/core/document-model/factory";
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
    expect(el.classList.contains("slide__text--editing")).toBe(true); // CSS hides its text lines but keeps its shape visible
  });

  it("renders list levels and list classes", () => {
    const p = createPresentation("Lists");
    const body = p.slides[0].objects[1];
    body.text = "one\n\ttwo\n\t\tthree";
    body.list = "number";
    const { container } = render(<SlideCanvas presentation={p} slide={p.slides[0]} displayWidth={480} />);
    const el = container.querySelector(".slide__text--body") as HTMLElement;
    expect(el.classList.contains("rt-list")).toBe(true);
    expect(el.classList.contains("rt-list--number")).toBe(true);
    const lines = [...el.querySelectorAll(".rt-line")];
    expect(lines.map((l) => l.textContent)).toEqual(["one", "two", "three"]);
    expect(lines.map((l) => l.getAttribute("data-level"))).toEqual([null, "1", "2"]);
    expect(container.querySelector(".slide__text--title")!.classList.contains("rt-list")).toBe(false);
  });

  describe("shapes", () => {
    const build = (kind: "rectangle" | "roundRect" | "ellipse" | "line", tweak: Record<string, unknown> = {}) => {
      const p = createPresentation("Shapes");
      const shape = Object.assign(createShape(kind, "Shape", { x: 100, y: 100, width: 240, height: 140 }), tweak);
      p.slides[0].objects.push(shape);
      const view = render(<SlideCanvas presentation={p} slide={p.slides[0]} displayWidth={480} hideObjectId={(tweak.__hide as string) ?? null} />);
      const el = view.container.querySelector<HTMLElement>(`[data-text-id="${shape.id}"]`)!;
      return { view, el, layer: el.querySelector<HTMLElement>(".slide__shape") };
    };

    it("draws a rectangle with its fill and outline", () => {
      const { layer } = build("rectangle");
      expect(layer).not.toBeNull();
      expect(layer!.getAttribute("data-shape")).toBe("rectangle");
      expect(layer).toHaveStyle({ backgroundColor: "#4472c4" });
      expect(layer!.style.borderStyle).toBe("solid");
      expect(layer!.style.borderWidth).toBe("2px");
      expect(layer).toHaveStyle({ borderColor: "#2f528f" });
      expect(parseFloat(layer!.style.borderRadius)).toBe(0);
    });

    it("rounds a rounded rectangle's corners to a sixth of its shorter side, and an ellipse fully", () => {
      expect(parseFloat(build("roundRect").layer!.style.borderRadius)).toBeCloseTo(140 / 6, 5);
      expect(build("ellipse").layer!.style.borderRadius).toBe("50%");
    });

    it("draws nothing for a plain text box, and only what is set for others", () => {
      const p = createPresentation("Plain");
      const { container } = render(<SlideCanvas presentation={p} slide={p.slides[0]} displayWidth={480} />);
      expect(container.querySelector(".slide__shape")).toBeNull();
      const noOutline = build("rectangle", { stroke: null }).layer!;
      expect(noOutline.style.borderStyle).toBe("none");
      expect(noOutline).toHaveStyle({ backgroundColor: "#4472c4" });
      const zeroWidth = build("rectangle", { strokeWidth: 0 }).layer!;
      expect(zeroWidth.style.borderStyle).toBe("none");
      const outlineOnly = build("rectangle", { fill: null }).layer!;
      expect(outlineOnly.style.backgroundColor).toBe("transparent");
      expect(outlineOnly.style.borderStyle).toBe("solid");
      expect(build("rectangle", { fill: null, stroke: null }).layer).toBeNull();
    });

    it("draws a line as an SVG stroke across the box, flipped when asked", () => {
      const down = build("line", { height: 0 }).el.querySelector("svg line")!;
      expect([down.getAttribute("x1"), down.getAttribute("y1"), down.getAttribute("x2"), down.getAttribute("y2")]).toEqual(["0", "0", "100%", "100%"]);
      expect(down.getAttribute("stroke")).toBe("#2f528f");
      expect(down.getAttribute("stroke-width")).toBe("3");
      const up = build("line", { flipV: true }).el.querySelector("svg line")!;
      expect([up.getAttribute("y1"), up.getAttribute("y2")]).toEqual(["100%", "0"]);
      expect(build("line").el.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    });

    it("lines carry no text lines, closed shapes do, centered and white by default", () => {
      expect(build("line").el.querySelectorAll(".rt-line")).toHaveLength(0);
      const { el } = build("rectangle", { text: "Hi" });
      expect([...el.querySelectorAll(".rt-line")].map((l) => l.textContent)).toEqual(["Hi"]);
      expect(el.style.textAlign).toBe("center");
      expect(el).toHaveStyle({ color: "#ffffff" });
    });

    it("keeps the shape visible while its text is edited in place (only the text lines are hidden)", () => {
      const p = createPresentation("Edit");
      const shape = createShape("ellipse", "Oval", { x: 100, y: 100, width: 200, height: 140 });
      shape.text = "typing";
      p.slides[0].objects.push(shape);
      const { container } = render(<SlideCanvas presentation={p} slide={p.slides[0]} displayWidth={480} hideObjectId={shape.id} />);
      const el = container.querySelector<HTMLElement>(`[data-text-id="${shape.id}"]`)!;
      expect(el.classList.contains("slide__text--editing")).toBe(true);
      expect(el.querySelector(".slide__shape")).not.toBeNull();
      expect(el.style.visibility).toBe("");
    });
  });
});

