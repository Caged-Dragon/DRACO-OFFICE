import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPresentation, createSlide } from "../../src/core/document-model/factory";
import { SlidePane } from "../../src/features/editor/SlidePane";

const scrollIntoView = vi.fn();
beforeEach(() => {
  scrollIntoView.mockClear();
  Object.defineProperty(Element.prototype, "scrollIntoView", { value: scrollIntoView, configurable: true, writable: true });
});

function makePresentation() {
  const p = createPresentation("Pane");
  p.slides.push(createSlide("Slide 2"), createSlide("Slide 3"));
  return p;
}

function Harness({ onMove = () => {} }: { onMove?: (id: string, to: number) => void }) {
  const [p] = useState(makePresentation);
  const [current, setCurrent] = useState(p.slides[0].id);
  return (
    <>
      <button onClick={() => setCurrent(p.slides[2].id)}>Jump to last</button>
      <SlidePane presentation={p} currentSlideId={current} onSelect={setCurrent} onMove={onMove} />
    </>
  );
}

const thumbs = () => within(screen.getByRole("navigation", { name: "Slides" })).getAllByRole("button");

describe("SlidePane keyboard and sync", () => {
  it("only the selected thumbnail is in the Tab order", () => {
    render(<Harness />);
    expect(thumbs().map((b) => b.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
  });

  it("Arrow keys select the neighbour and focus follows; Home/End jump", () => {
    render(<Harness />);
    thumbs()[0].focus();
    fireEvent.keyDown(thumbs()[0], { key: "ArrowDown" });
    expect(thumbs()[1]).toHaveFocus();
    expect(thumbs()[1]).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(thumbs()[1], { key: "End" });
    expect(thumbs()[2]).toHaveFocus();
    fireEvent.keyDown(thumbs()[2], { key: "ArrowDown" }); // already last: nothing happens
    expect(thumbs()[2]).toHaveFocus();
    fireEvent.keyDown(thumbs()[2], { key: "Home" });
    expect(thumbs()[0]).toHaveFocus();
  });

  it("Alt+Arrow reorders instead of selecting", () => {
    const onMove = vi.fn();
    render(<Harness onMove={onMove} />);
    fireEvent.keyDown(thumbs()[0], { key: "ArrowDown", altKey: true });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(thumbs()[0]).toHaveAttribute("aria-current", "true");
  });

  it("scrolls the selection into view without stealing focus from elsewhere", () => {
    render(<Harness />);
    const jump = screen.getByRole("button", { name: "Jump to last" });
    jump.focus();
    scrollIntoView.mockClear();
    fireEvent.click(jump);
    expect(thumbs()[2]).toHaveAttribute("aria-current", "true");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(jump).toHaveFocus();
  });
});
