import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
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
  fireEvent.click(screen.getByRole("tab", { name: "Home" }));
};
const actualSize = () => {
  fireEvent.click(screen.getByRole("tab", { name: "View" }));
  fireEvent.click(screen.getByRole("button", { name: "Actual size" }));
  fireEvent.click(screen.getByRole("tab", { name: "Home" }));
};
const canvas = () => screen.getByRole("group", { name: "Slide canvas" });
const status = () => screen.queryByText(/^Selected: /)?.textContent ?? null;
const key = (k: string, mods: Record<string, boolean> = {}) => fireEvent.keyDown(canvas(), { key: k, ...mods });
const field = (name: string) => screen.getByRole("spinbutton", { name }) as HTMLInputElement;
const setField = (name: string, value: string) => {
  fireEvent.change(field(name), { target: { value } });
  fireEvent.blur(field(name));
};
const BOX = "Selected: Text box 1 (330, 230, 300 × 80)";

describe("keyboard nudging and resizing", () => {
  it("arrow keys move the selected object by 10 px, Ctrl or Cmd by 1 px", async () => {
    await openEditor();
    insertTextBox();
    key("ArrowRight");
    expect(status()).toBe("Selected: Text box 1 (340, 230, 300 × 80)");
    key("ArrowDown");
    key("ArrowDown");
    expect(status()).toBe("Selected: Text box 1 (340, 250, 300 × 80)");
    key("ArrowLeft", { ctrlKey: true });
    key("ArrowUp", { metaKey: true });
    expect(status()).toBe("Selected: Text box 1 (339, 249, 300 × 80)");
  });

  it("Shift+arrows resize from the top-left corner: right and down grow, left and up shrink", async () => {
    await openEditor();
    insertTextBox();
    key("ArrowRight", { shiftKey: true });
    key("ArrowDown", { shiftKey: true });
    expect(status()).toBe("Selected: Text box 1 (330, 230, 310 × 90)");
    key("ArrowLeft", { shiftKey: true });
    key("ArrowUp", { shiftKey: true });
    key("ArrowLeft", { shiftKey: true, ctrlKey: true });
    key("ArrowUp", { shiftKey: true, ctrlKey: true });
    expect(status()).toBe("Selected: Text box 1 (330, 230, 299 × 79)");
  });

  it("resizing by keyboard stops at the minimum size", async () => {
    await openEditor();
    insertTextBox();
    for (let i = 0; i < 40; i++) {
      key("ArrowLeft", { shiftKey: true });
      key("ArrowUp", { shiftKey: true });
    }
    expect(status()).toBe("Selected: Text box 1 (330, 230, 20 × 20)");
  });

  it("an object cannot be nudged off the slide completely", async () => {
    await openEditor();
    insertTextBox();
    for (let i = 0; i < 120; i++) key("ArrowRight");
    expect(status()).toBe("Selected: Text box 1 (940, 230, 300 × 80)");
  });

  it("arrow keys still pan when nothing is selected, and do not pan when something is", async () => {
    await openEditor();
    actualSize();
    fireEvent.mouseMove(canvas(), { clientX: 0, clientY: 0 });
    expect(screen.getByText(/^Pointer /).textContent).toBe("Pointer 80, 20");
    key("ArrowRight"); // nothing selected: pans by 40
    fireEvent.mouseMove(canvas(), { clientX: 0, clientY: 0 });
    expect(screen.getByText(/^Pointer /).textContent).toBe("Pointer 120, 20");
    insertTextBox();
    key("ArrowRight"); // object selected: moves the object instead
    fireEvent.mouseMove(canvas(), { clientX: 0, clientY: 0 });
    expect(screen.getByText(/^Pointer /).textContent).toBe("Pointer 120, 20");
    expect(status()).toBe("Selected: Text box 1 (340, 230, 300 × 80)");
  });

  it("arrow keys are left to the text editor while editing", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(screen.getByRole("button", { name: "Text box 1" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Editing Text box 1" }), { key: "ArrowRight" });
    expect(status()).toBe(`${BOX} – editing text`);
  });

  it("nudges are autosaved", async () => {
    await openEditor();
    insertTextBox();
    key("ArrowRight");
    key("ArrowDown", { ctrlKey: true });
    await waitFor(async () => {
      const list = await listPresentations();
      expect(list.some((p) => p.slides[0].objects.some((o) => o.role === "textbox" && o.x === 340 && o.y === 231))).toBe(true);
    });
  });
});

describe("selecting objects from the keyboard", () => {
  it("Tab and Shift+Tab walk through the objects, then let focus move on", async () => {
    await openEditor();
    expect(key("Tab")).toBe(false); // selects the first object: default prevented
    expect(status()).toBe("Selected: Title (80, 60, 800 × 100)");
    expect(key("Tab")).toBe(false);
    expect(status()).toBe("Selected: Body (80, 200, 800 × 260)");
    expect(key("Tab", { shiftKey: true })).toBe(false);
    expect(status()).toBe("Selected: Title (80, 60, 800 × 100)");
    expect(key("Tab", { shiftKey: true })).toBe(true); // before the first object: selection cleared, focus moves on
    expect(status()).toBeNull();
    key("Tab");
    key("Tab");
    expect(key("Tab")).toBe(true); // after the last object
    expect(status()).toBeNull();
  });

  it("Shift+Tab with nothing selected, and Ctrl+Tab, are left to the browser", async () => {
    await openEditor();
    expect(key("Tab", { shiftKey: true })).toBe(true);
    expect(key("Tab", { ctrlKey: true })).toBe(true);
    expect(status()).toBeNull();
  });

  it("includes text boxes in the order they were added", async () => {
    await openEditor();
    insertTextBox();
    key("Escape");
    key("Tab");
    key("Tab");
    key("Tab");
    expect(status()).toBe(BOX);
  });
});

describe("position and size fields", () => {
  it("are disabled until an object is selected, then show its geometry", async () => {
    await openEditor();
    for (const n of ["X position", "Y position", "Width", "Height"]) expect(field(n), n).toBeDisabled();
    key("Tab");
    expect([field("X position").value, field("Y position").value, field("Width").value, field("Height").value]).toEqual(["80", "60", "800", "100"]);
  });

  it("typing a value moves or resizes the object", async () => {
    await openEditor();
    insertTextBox();
    setField("X position", "200");
    setField("Y position", "100");
    expect(status()).toBe("Selected: Text box 1 (200, 100, 300 × 80)");
    setField("Width", "450");
    setField("Height", "120");
    expect(status()).toBe("Selected: Text box 1 (200, 100, 450 × 120)");
  });

  it("values are clamped to what the slide allows, and the field shows the clamped value", async () => {
    await openEditor();
    insertTextBox();
    setField("X position", "99999");
    expect(field("X position")).toHaveValue(940);
    setField("X position", "-500");
    expect(field("X position")).toHaveValue(-280); // 20 px of the 300 px box must stay on the slide
    setField("Width", "3");
    expect(field("Width")).toHaveValue(20);
    // a 20 px wide box must keep all 20 px on the slide, so its x moves from -280 to 0
    expect(status()).toBe("Selected: Text box 1 (0, 230, 20 × 80)");
    expect(field("X position")).toHaveValue(0);
  });

  it("keeps two decimals, ignores non-numbers, and follows keyboard nudges", async () => {
    await openEditor();
    insertTextBox();
    setField("X position", "10.456");
    expect(field("X position")).toHaveValue(10.46);
    setField("Y position", "");
    expect(field("Y position")).toHaveValue(230);
    key("ArrowRight");
    expect(field("X position")).toHaveValue(20.46);
  });

  it("work for placeholders too", async () => {
    await openEditor();
    key("Tab");
    setField("Width", "600");
    expect(status()).toBe("Selected: Title (80, 60, 600 × 100)");
  });

  it("the Position group has no accessibility violations with an object selected", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.keyDown(screen.getByRole("group", { name: "Slide canvas" }), { key: "Tab" });
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 100)).join(" | ")}`)).toEqual([]);
  });
});

describe("modifier keys while dragging", () => {
  const box = () => screen.getByRole("button", { name: "Text box 1" });
  const drag = (el: HTMLElement, from: [number, number], to: [number, number], mods: Record<string, boolean> = {}) => {
    fireEvent.mouseDown(el, { button: 0, clientX: from[0], clientY: from[1] });
    fireEvent.mouseMove(window, { clientX: to[0], clientY: to[1], ...mods });
    fireEvent.mouseUp(window);
  };

  it("Shift while moving slides along one axis only", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(box(), [400, 300], [450, 310], { shiftKey: true });
    expect(status()).toBe("Selected: Text box 1 (380, 230, 300 × 80)");
    drag(box(), [400, 300], [410, 360], { shiftKey: true });
    expect(status()).toBe("Selected: Text box 1 (380, 290, 300 × 80)");
    drag(box(), [400, 300], [440, 310]); // without Shift both axes move
    expect(status()).toBe("Selected: Text box 1 (420, 300, 300 × 80)");
  });

  it("Shift on a corner handle keeps the proportions", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(screen.getByTestId("handle-se"), [630, 310], [660, 310], { shiftKey: true });
    expect(status()).toBe("Selected: Text box 1 (330, 230, 330 × 88)");
  });

  it("Ctrl or Cmd on a handle resizes around the center", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(screen.getByTestId("handle-e"), [630, 270], [660, 270], { ctrlKey: true });
    expect(status()).toBe("Selected: Text box 1 (300, 230, 360 × 80)");
    drag(screen.getByTestId("handle-s"), [480, 310], [480, 320], { metaKey: true });
    expect(status()).toBe("Selected: Text box 1 (300, 220, 360 × 100)");
  });
});
