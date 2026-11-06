import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Ruler } from "../../src/features/canvas/Ruler";

describe("Ruler", () => {
  it("draws a horizontal ruler with labels, the slide band and the selection band", () => {
    const { container } = render(<Ruler orientation="horizontal" view={{ zoom: 1, panX: -80, panY: 0 }} length={200} slideLength={960} selection={[100, 300]} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("width")).toBe("200");
    expect(svg.getAttribute("height")).toBe("20");
    expect([...container.querySelectorAll(".ruler__label")].map((t) => t.textContent)).toEqual(["100", "150", "200", "250"]);
    const slide = container.querySelector(".ruler__slide")!;
    expect(slide.getAttribute("x")).toBe("-80");
    expect(slide.getAttribute("width")).toBe("960");
    const sel = container.querySelector(".ruler__selection")!;
    expect(sel.getAttribute("x")).toBe("20");
    expect(sel.getAttribute("width")).toBe("200");
  });

  it("draws a vertical ruler", () => {
    const { container } = render(<Ruler orientation="vertical" view={{ zoom: 1, panX: 0, panY: 30 }} length={300} slideLength={540} selection={null} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("height")).toBe("300");
    expect(container.querySelector(".ruler__selection")).toBeNull();
    const major = container.querySelector(".ruler__tick--major")!;
    expect(major.getAttribute("y1")).toBe(major.getAttribute("y2"));
    expect(container.querySelector(".ruler__slide")!.getAttribute("y")).toBe("30");
  });

  it("scales the bands with the zoom", () => {
    const { container } = render(<Ruler orientation="horizontal" view={{ zoom: 2, panX: 10, panY: 0 }} length={400} slideLength={100} selection={[10, 20]} />);
    expect(container.querySelector(".ruler__slide")!.getAttribute("width")).toBe("200");
    expect(container.querySelector(".ruler__selection")!.getAttribute("width")).toBe("20");
  });
});
