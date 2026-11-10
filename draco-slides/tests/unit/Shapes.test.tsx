import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { listPresentations } from "../../src/services/storage/presentationStore";

async function openEditor() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
}
const tab = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));
const btn = (name: string) => screen.getByRole("button", { name });
const hit = (name: string) => screen.getByRole("button", { name });
const insert = (name: string) => {
  tab("Insert");
  fireEvent.click(btn(name));
  tab("Home");
};
const actualSize = () => {
  tab("View");
  fireEvent.click(btn("Actual size"));
  tab("Home");
};
const canvas = () => screen.getByRole("group", { name: "Slide canvas" });
const status = () => screen.queryByText(/^Selected: /)?.textContent ?? null;
const key = (k: string, mods: Record<string, boolean> = {}) => fireEvent.keyDown(canvas(), { key: k, ...mods });
const field = (name: string) => screen.getByRole("spinbutton", { name }) as HTMLInputElement;
const setField = (name: string, value: string) => {
  fireEvent.change(field(name), { target: { value } });
  fireEvent.blur(field(name));
};
const inCanvas = (selector: string) => document.querySelector<HTMLElement>(`.viewport ${selector}`);
const drag = (el: HTMLElement, from: [number, number], to: [number, number]) => {
  fireEvent.mouseDown(el, { button: 0, clientX: from[0], clientY: from[1] });
  fireEvent.mouseMove(window, { clientX: to[0], clientY: to[1] });
  fireEvent.mouseUp(window, { clientX: to[0], clientY: to[1] });
};

describe("Insert > Shapes", () => {
  it("offers rectangle, rounded rectangle, oval and line", async () => {
    await openEditor();
    tab("Insert");
    const group = within(screen.getByRole("group", { name: "Shapes" }));
    expect(group.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Rectangle", "Rounded rectangle", "Oval", "Line"]);
  });

  it("inserts each shape in the middle of the slide, selected, and draws it on the canvas and in the thumbnail", async () => {
    await openEditor();
    insert("Rectangle");
    expect(status()).toBe("Selected: Rectangle 1 (360, 200, 240 × 140)");
    expect(inCanvas('.slide__shape[data-shape="rectangle"]')).not.toBeNull();
    expect(screen.getAllByTestId(/^handle-/)).toHaveLength(8);
    insert("Rounded rectangle");
    expect(status()).toBe("Selected: Rounded rectangle 1 (384, 224, 240 × 140)");
    expect(inCanvas('.slide__shape[data-shape="roundRect"]')).not.toBeNull();
    insert("Oval");
    expect(status()).toBe("Selected: Oval 1 (380, 200, 200 × 140)");
    expect(inCanvas('.slide__shape[data-shape="ellipse"]')).not.toBeNull();
    insert("Line");
    expect(status()).toBe("Selected: Line 1 (360, 270, 240 × 0)");
    expect(inCanvas("svg.slide__shape--line")).not.toBeNull();
    const nav = screen.getByRole("navigation", { name: "Slides" });
    expect(nav.querySelectorAll(".slide__shape").length).toBe(4);
  });

  it("numbers shapes of the same kind", async () => {
    await openEditor();
    insert("Rectangle");
    insert("Rectangle");
    expect(status()).toBe("Selected: Rectangle 2 (384, 224, 240 × 140)");
  });

  it("inserting is an undo step", async () => {
    await openEditor();
    insert("Oval");
    expect(btn("Undo")).toHaveAttribute("title", "Undo Insert shape (Ctrl+Z)");
    fireEvent.click(btn("Undo"));
    expect(screen.queryByRole("button", { name: "Oval 1" })).toBeNull();
    expect(status()).toBeNull();
  });
});

describe("moving and resizing shapes", () => {
  it("shapes move and resize like any object", async () => {
    await openEditor();
    insert("Rectangle");
    key("ArrowRight");
    key("ArrowDown", { shiftKey: true });
    expect(status()).toBe("Selected: Rectangle 1 (370, 200, 240 × 150)");
    expect(field("X position")).toHaveValue(370);
    setField("Width", "300");
    expect(status()).toBe("Selected: Rectangle 1 (370, 200, 300 × 150)");
  });

  it("a rectangle cannot be made smaller than 20 x 20", async () => {
    await openEditor();
    insert("Rectangle");
    setField("Height", "3");
    expect(field("Height")).toHaveValue(20);
  });

  it("a line can be resized by its handles, and a flat line's hit box is thick enough to click", async () => {
    await openEditor();
    actualSize();
    insert("Line");
    const h = hit("Line 1");
    expect([h.style.left, h.style.top, h.style.width, h.style.height]).toEqual(["360px", "264px", "240px", "12px"]);
    drag(screen.getByTestId("handle-s"), [480, 270], [480, 320]);
    expect(status()).toBe("Selected: Line 1 (360, 270, 240 × 50)");
  });

  it("the Position fields allow a flat line but never a vanishing one", async () => {
    await openEditor();
    insert("Line");
    expect(field("Height").min).toBe("0");
    expect(field("Width").min).toBe("0");
    setField("Width", "3"); // too short: ignored
    expect(status()).toBe("Selected: Line 1 (360, 270, 240 × 0)");
    setField("Width", "10");
    expect(status()).toBe("Selected: Line 1 (360, 270, 10 × 0)");
    setField("Height", "100");
    expect(status()).toBe("Selected: Line 1 (360, 270, 10 × 100)");
  });
});

describe("text in shapes", () => {
  it("a rectangle takes text typed in place, and its shape stays visible while editing", async () => {
    await openEditor();
    insert("Rectangle");
    fireEvent.doubleClick(hit("Rectangle 1"));
    const editor = screen.getByRole("textbox", { name: "Editing Rectangle 1" });
    expect(inCanvas(".slide__text--editing .slide__shape")).not.toBeNull();
    editor.firstElementChild!.textContent = "Hello";
    fireEvent.input(editor);
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(screen.getByRole("textbox", { name: "Rectangle 1" })).toHaveValue("Hello"); // the Text panel
    expect(within(inCanvas('.slide__text--shape')!).getByText("Hello")).toBeInTheDocument();
  });

  it("a line carries no text: no editing, no text commands, no entry in the Text panel", async () => {
    await openEditor();
    insert("Line");
    fireEvent.doubleClick(hit("Line 1"));
    expect(screen.queryByRole("textbox", { name: /^Editing / })).toBeNull();
    key("Enter");
    key("F2");
    expect(screen.queryByRole("textbox", { name: /^Editing / })).toBeNull();
    expect(btn("Edit text")).toBeDisabled();
    expect(btn("Bold")).toBeDisabled();
    expect(screen.queryByRole("textbox", { name: "Line 1" })).toBeNull();
    insert("Oval");
    expect(screen.getByRole("textbox", { name: "Oval 1" })).toBeInTheDocument();
  });
});

describe("other features work on shapes", () => {
  it("delete, group and lock", async () => {
    await openEditor();
    insert("Rectangle");
    insert("Oval");
    key("a", { ctrlKey: true });
    fireEvent.click(btn("Group"));
    expect(status()).toMatch(/^Selected: group of 4 objects /);
    fireEvent.click(btn("Lock"));
    key("Delete");
    expect(hit("Rectangle 1")).toBeInTheDocument(); // locked: not deleted
    fireEvent.click(btn("Lock"));
    key("Delete");
    expect(screen.queryByRole("button", { name: "Rectangle 1" })).toBeNull();
  });

  it("shapes are autosaved with their style", async () => {
    await openEditor();
    insert("Oval");
    insert("Line");
    await waitFor(async () => {
      const objs = (await listPresentations()).flatMap((p) => p.slides[0].objects).filter((o) => o.role === "shape");
      expect(objs.some((o) => o.shape === "ellipse" && o.fill === "#4472c4" && o.stroke === "#2f528f")).toBe(true);
      expect(objs.some((o) => o.shape === "line" && o.fill === null && o.height === 0)).toBe(true);
    });
  });

  it("the Shapes group and a selected shape have no accessibility violations", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    insert("Rectangle");
    insert("Line");
    tab("Insert");
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 100)).join(" | ")}`)).toEqual([]);
  });
});
