import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

// jsdom has no layout, so the viewport falls back to 800x500 and the slide (960x540) fits at 0.7667 (77%).
async function openEditor() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
  return screen.getByRole("group", { name: "Slide canvas" });
}
const goToView = () => fireEvent.click(screen.getByRole("tab", { name: "View" }));
const pointer = () => screen.getByText(/^Pointer /).textContent;

describe("canvas viewport", () => {
  it("starts fitted to the window", async () => {
    await openEditor();
    expect(screen.getByText("Zoom 77%")).toBeInTheDocument();
  });

  it("zoom buttons step through presets; Fit and Actual size work", async () => {
    await openEditor();
    goToView();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("Zoom 100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("Zoom 75%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actual size" }));
    expect(screen.getByText("Zoom 100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fit to window" }));
    expect(screen.getByText("Zoom 77%")).toBeInTheDocument();
  });

  it("keyboard: + zooms in, - zooms out, 0 fits", async () => {
    const viewport = await openEditor();
    fireEvent.keyDown(viewport, { key: "+" });
    expect(screen.getByText("Zoom 100%")).toBeInTheDocument();
    fireEvent.keyDown(viewport, { key: "-" });
    expect(screen.getByText("Zoom 75%")).toBeInTheDocument();
    fireEvent.keyDown(viewport, { key: "0" });
    expect(screen.getByText("Zoom 77%")).toBeInTheDocument();
  });

  it("Ctrl+wheel zooms at the cursor; plain wheel does not change zoom", async () => {
    const viewport = await openEditor();
    fireEvent.wheel(viewport, { ctrlKey: true, deltaY: -100, clientX: 400, clientY: 250 });
    expect(screen.getByText(/^Zoom 9[34]%$/)).toBeInTheDocument();
    fireEvent.wheel(viewport, { deltaY: 50 });
    expect(screen.getByText(/^Zoom 9[34]%$/)).toBeInTheDocument();
  });

  it("shows the pointer in slide coordinates and clears it on leave", async () => {
    const viewport = await openEditor();
    goToView();
    fireEvent.click(screen.getByRole("button", { name: "Actual size" })); // zoom 1, pan (-80, -20)
    expect(pointer()).toBe("Pointer —");
    fireEvent.mouseMove(viewport, { clientX: 100, clientY: 50 });
    expect(pointer()).toBe("Pointer 180, 70");
    fireEvent.mouseLeave(viewport);
    expect(pointer()).toBe("Pointer —");
  });

  it("arrow keys pan the view", async () => {
    const viewport = await openEditor();
    goToView();
    fireEvent.click(screen.getByRole("button", { name: "Actual size" }));
    fireEvent.keyDown(viewport, { key: "ArrowRight" }); // content moves left by 40
    fireEvent.mouseMove(viewport, { clientX: 0, clientY: 0 });
    expect(pointer()).toBe("Pointer 120, 20");
  });

  it("Space + drag pans, and so does the middle button", async () => {
    const viewport = await openEditor();
    goToView();
    fireEvent.click(screen.getByRole("button", { name: "Actual size" })); // pan (-80, -20)
    fireEvent.keyDown(viewport, { key: " " });
    fireEvent.mouseDown(viewport, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 150, clientY: 130 });
    fireEvent.mouseUp(window);
    fireEvent.keyUp(viewport, { key: " " });
    fireEvent.mouseMove(viewport, { clientX: 0, clientY: 0 });
    expect(pointer()).toBe("Pointer 30, -10"); // pan is now (-30, 10)

    fireEvent.mouseDown(viewport, { button: 1, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 10, clientY: 10 });
    fireEvent.mouseUp(window);
    fireEvent.mouseMove(viewport, { clientX: 0, clientY: 0 });
    expect(pointer()).toBe("Pointer 20, -20"); // pan is now (-20, 20)
  });

  it("a plain left-button drag does not pan (reserved for selecting objects)", async () => {
    const viewport = await openEditor();
    goToView();
    fireEvent.click(screen.getByRole("button", { name: "Actual size" }));
    fireEvent.mouseDown(viewport, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(window);
    fireEvent.mouseMove(viewport, { clientX: 0, clientY: 0 });
    expect(pointer()).toBe("Pointer 80, 20");
  });

  it("panning cannot lose the slide: it stops with a margin still visible", async () => {
    const viewport = await openEditor();
    goToView();
    fireEvent.click(screen.getByRole("button", { name: "Actual size" }));
    for (let i = 0; i < 40; i++) fireEvent.keyDown(viewport, { key: "ArrowRight", shiftKey: true });
    fireEvent.mouseMove(viewport, { clientX: 0, clientY: 0 });
    expect(pointer()).toBe("Pointer 912, 20"); // pan x clamped to 48 - 960
  });

  it("keeps the zoom when switching slides", async () => {
    await openEditor();
    goToView();
    fireEvent.click(screen.getByRole("button", { name: "Actual size" }));
    fireEvent.click(screen.getByRole("tab", { name: "Home" }));
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    expect(screen.getByText("Zoom 100%")).toBeInTheDocument();
  });

  it("shows objects that extend past the slide edge on the editing canvas but clips thumbnails", async () => {
    await openEditor();
    const canvas = within(screen.getByRole("group", { name: "Slide canvas" })).getByRole("img");
    expect(canvas.className).toContain("slide--overflow");
    const thumb = within(screen.getByRole("navigation", { name: "Slides" })).getAllByRole("img")[0];
    expect(thumb.className).not.toContain("slide--overflow");
  });
});
