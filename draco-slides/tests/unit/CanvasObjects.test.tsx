import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { listPresentations } from "../../src/services/storage/presentationStore";

async function openEditor() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
}
const insertTextBox = () => {
  fireEvent.click(screen.getByRole("tab", { name: "Insert" }));
  fireEvent.click(screen.getByRole("button", { name: "Text box" }));
};
const actualSize = () => {
  fireEvent.click(screen.getByRole("tab", { name: "View" }));
  fireEvent.click(screen.getByRole("button", { name: "Actual size" }));
};
const canvas = () => screen.getByRole("group", { name: "Slide canvas" });
const box = () => screen.getByRole("button", { name: "Text box 1" });
const selected = () => screen.queryByText(/^Selected: /)?.textContent ?? null;
const drag = (el: HTMLElement, from: [number, number], to: [number, number], target: HTMLElement | Window = window) => {
  fireEvent.mouseDown(el, { button: 0, clientX: from[0], clientY: from[1] });
  fireEvent.mouseMove(target, { clientX: to[0], clientY: to[1] });
  fireEvent.mouseUp(target);
};

describe("text boxes on the canvas", () => {
  it("Insert > Text box adds a centered, selected box with handles", async () => {
    await openEditor();
    insertTextBox();
    expect(selected()).toBe("Selected: Text box 1 (330, 230, 300 × 80)");
    expect(box()).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId(/^handle-/)).toHaveLength(8);
    expect(screen.getByDisplayValue("Text box")).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Slides" })).getAllByText("Text box").length).toBeGreaterThan(0);
  });

  it("dragging moves the object by the mouse distance at 100% zoom", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    expect(box()).toHaveStyle({ left: "330px", top: "230px" });
    drag(box(), [400, 300], [450, 330]);
    expect(box()).toHaveStyle({ left: "380px", top: "260px" });
    expect(selected()).toBe("Selected: Text box 1 (380, 260, 300 × 80)");
  });

  it("dragging is measured in slide units, so zoom does not change the result", async () => {
    await openEditor(); // fitted: zoom is 736/960
    insertTextBox();
    drag(box(), [100, 100], [123, 100]); // 23 screen px = 30 slide px
    expect(selected()).toBe("Selected: Text box 1 (360, 230, 300 × 80)");
  });

  it("a click or a tiny wiggle selects but does not change the document", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    fireEvent.mouseDown(canvas(), { button: 0, clientX: 5, clientY: 5 }); // clear selection
    expect(selected()).toBeNull();
    drag(box(), [400, 300], [402, 301]);
    expect(selected()).toBe("Selected: Text box 1 (330, 230, 300 × 80)");
  });

  it("handles resize; the opposite edge stays put and the size has a minimum", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(screen.getByTestId("handle-se"), [600, 400], [640, 420]);
    expect(selected()).toBe("Selected: Text box 1 (330, 230, 340 × 100)");
    drag(screen.getByTestId("handle-nw"), [330, 230], [340, 240]);
    expect(selected()).toBe("Selected: Text box 1 (340, 240, 330 × 90)");
    drag(screen.getByTestId("handle-w"), [340, 285], [5000, 285]);
    expect(selected()).toBe("Selected: Text box 1 (650, 240, 20 × 90)");
    expect(box()).toHaveStyle({ width: "20px", height: "90px" });
  });

  it("an object cannot be dragged completely off the slide", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(box(), [400, 300], [9000, 300]);
    expect(selected()).toBe("Selected: Text box 1 (940, 230, 300 × 80)");
  });

  it("clicking empty canvas or pressing Escape clears the selection", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.mouseDown(canvas(), { button: 0, clientX: 5, clientY: 5 });
    expect(selected()).toBeNull();
    expect(screen.queryAllByTestId(/^handle-/)).toHaveLength(0);
    fireEvent.mouseDown(box(), { button: 0, clientX: 400, clientY: 300 });
    fireEvent.mouseUp(window);
    expect(selected()).not.toBeNull();
    fireEvent.keyDown(canvas(), { key: "Escape" });
    expect(selected()).toBeNull();
  });

  it("Delete and Backspace remove the selected object when the canvas has focus", async () => {
    await openEditor();
    insertTextBox();
    canvas().focus();
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(screen.queryByRole("button", { name: "Text box 1" })).not.toBeInTheDocument();
    expect(selected()).toBeNull();
    insertTextBox();
    fireEvent.keyDown(canvas(), { key: "Backspace" });
    expect(screen.queryByRole("button", { name: "Text box 1" })).not.toBeInTheDocument();
  });

  it("Delete does nothing when nothing is selected, and the ribbon button follows the selection", async () => {
    await openEditor();
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(screen.getByRole("button", { name: "Title" })).toBeInTheDocument(); // placeholder still there
    expect(screen.getByRole("button", { name: "Delete object" })).toBeDisabled();
    insertTextBox();
    fireEvent.click(screen.getByRole("tab", { name: "Home" }));
    const del = screen.getByRole("button", { name: "Delete object" });
    expect(del).toBeEnabled();
    fireEvent.click(del);
    expect(screen.queryByRole("button", { name: "Text box 1" })).not.toBeInTheDocument();
    expect(del).toBeDisabled();
  });

  it("selection belongs to the slide: switching slides clears it", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(screen.getByRole("tab", { name: "Home" }));
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    expect(selected()).toBeNull();
    expect(screen.queryByRole("button", { name: "Text box 1" })).not.toBeInTheDocument();
  });

  it("focusing a box in the text panel selects it on the canvas", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.mouseDown(canvas(), { button: 0, clientX: 5, clientY: 5 });
    expect(selected()).toBeNull();
    act(() => screen.getByRole("textbox", { name: "Text box 1" }).focus());
    expect(selected()).toBe("Selected: Text box 1 (330, 230, 300 × 80)");
  });

  it("Space+drag over an object pans instead of moving it", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    fireEvent.keyDown(canvas(), { key: " " });
    drag(box(), [400, 300], [450, 330]);
    fireEvent.keyUp(canvas(), { key: " " });
    expect(selected()).toBe("Selected: Text box 1 (330, 230, 300 × 80)");
    fireEvent.mouseMove(canvas(), { clientX: 0, clientY: 0 });
    expect(screen.getByText(/^Pointer /).textContent).toBe("Pointer 30, -10");
  });

  it("a moved box is autosaved", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(box(), [400, 300], [450, 330]);
    await waitFor(async () => {
      const list = await listPresentations();
      expect(list.some((p) => p.slides[0].objects.some((o) => o.role === "textbox" && o.x === 380 && o.y === 260))).toBe(true);
    });
  });
});
