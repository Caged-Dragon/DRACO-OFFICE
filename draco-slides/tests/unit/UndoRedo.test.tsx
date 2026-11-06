import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { listPresentations } from "../../src/services/storage/presentationStore";

async function openEditor() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
}
const tab = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));
const insertTextBox = () => {
  tab("Insert");
  fireEvent.click(screen.getByRole("button", { name: "Text box" }));
  tab("Home");
};
const actualSize = () => {
  tab("View");
  fireEvent.click(screen.getByRole("button", { name: "Actual size" }));
  tab("Home");
};
const canvas = () => screen.getByRole("group", { name: "Slide canvas" });
const btn = (name: string) => screen.getByRole("button", { name });
const hit = (name: string) => screen.getByRole("button", { name });
const status = () => screen.queryByText(/^Selected: /)?.textContent ?? null;
const note = () => screen.getByTestId("history-note").textContent;
const key = (k: string, mods: Record<string, boolean> = {}) => fireEvent.keyDown(canvas(), { key: k, ...mods });
const press = (el: HTMLElement, mods: Record<string, boolean> = {}) => {
  fireEvent.mouseDown(el, { button: 0, clientX: 1, clientY: 1, ...mods });
  fireEvent.mouseUp(window, { clientX: 1, clientY: 1 });
};
/** One drag with several mouse moves along the way, like a real one. */
const drag = (el: HTMLElement, steps: [number, number][]) => {
  fireEvent.mouseDown(el, { button: 0, clientX: 100, clientY: 100 });
  for (const [dx, dy] of steps) fireEvent.mouseMove(window, { clientX: 100 + dx, clientY: 100 + dy });
  const [lx, ly] = steps[steps.length - 1];
  fireEvent.mouseUp(window, { clientX: 100 + lx, clientY: 100 + ly });
};
const panelText = () => screen.getByRole("textbox", { name: "Text box 1" });
const BOX = (x: number, y = 230) => `Selected: Text box 1 (${x}, ${y}, 300 × 80)`;

describe("Undo and Redo buttons", () => {
  it("start disabled, follow the history, and say what they will do", async () => {
    await openEditor();
    expect(btn("Undo")).toBeDisabled();
    expect(btn("Redo")).toBeDisabled();
    expect(btn("Undo")).toHaveAttribute("title", "Nothing to undo");
    fireEvent.click(btn("New slide"));
    expect(screen.getByText("Slide 2 of 2")).toBeInTheDocument();
    expect(btn("Undo")).toBeEnabled();
    expect(btn("Undo")).toHaveAttribute("title", "Undo New slide (Ctrl+Z)");
    fireEvent.click(btn("Undo"));
    expect(screen.getByText("Slide 1 of 1")).toBeInTheDocument();
    expect(btn("Undo")).toBeDisabled();
    expect(btn("Redo")).toBeEnabled();
    expect(btn("Redo")).toHaveAttribute("title", "Redo New slide (Ctrl+Y)");
    fireEvent.click(btn("Redo"));
    expect(screen.getByText("Slide 2 of 2")).toBeInTheDocument();
    expect(btn("Redo")).toBeDisabled();
  });

  it("announce what was undone or redone to screen readers", async () => {
    await openEditor();
    fireEvent.click(btn("New slide"));
    fireEvent.click(btn("Undo"));
    expect(note()).toBe("Undid New slide");
    fireEvent.click(btn("Redo"));
    expect(note()).toBe("Redid New slide");
  });

  it("a new change after an undo clears Redo", async () => {
    await openEditor();
    fireEvent.click(btn("New slide"));
    fireEvent.click(btn("Undo"));
    expect(btn("Redo")).toBeEnabled();
    fireEvent.click(btn("Duplicate slide"));
    expect(btn("Redo")).toBeDisabled();
  });

  it("changing slides or selecting things is not an undo step", async () => {
    await openEditor();
    fireEvent.click(btn("New slide"));
    fireEvent.click(screen.getByRole("button", { name: /^Slide 1:/ }));
    press(hit("Title"));
    fireEvent.click(btn("Undo")); // undoes the new slide, not the clicks
    expect(screen.getByText("Slide 1 of 1")).toBeInTheDocument();
    expect(btn("Undo")).toBeDisabled();
  });
});

describe("keyboard shortcuts", () => {
  it("Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo, and Cmd works too", async () => {
    await openEditor();
    fireEvent.click(btn("New slide"));
    canvas().focus();
    expect(key("z", { ctrlKey: true })).toBe(false); // handled: default prevented
    expect(screen.getByText("Slide 1 of 1")).toBeInTheDocument();
    key("y", { ctrlKey: true });
    expect(screen.getByText("Slide 2 of 2")).toBeInTheDocument();
    key("z", { metaKey: true });
    expect(screen.getByText("Slide 1 of 1")).toBeInTheDocument();
    key("Z", { ctrlKey: true, shiftKey: true });
    expect(screen.getByText("Slide 2 of 2")).toBeInTheDocument();
  });

  it("do nothing when there is nothing to undo or redo", async () => {
    await openEditor();
    key("z", { ctrlKey: true });
    key("y", { ctrlKey: true });
    expect(screen.getByText("Slide 1 of 1")).toBeInTheDocument();
  });

  it("are left to the browser inside text fields and the text editor", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
    expect(fireEvent.keyDown(editor, { key: "z", ctrlKey: true })).toBe(true); // not prevented: the browser undoes the typing
    expect(screen.getByRole("textbox", { name: "Editing Text box 1" })).toBe(editor);
    expect(btn("Undo")).toBeEnabled(); // history untouched
    expect(fireEvent.keyDown(screen.getByRole("textbox", { name: "Presentation title" }), { key: "z", ctrlKey: true })).toBe(true);
  });
});

describe("what one undo step covers", () => {
  it("a whole drag, however many mouse moves, is one step", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(hit("Text box 1"), [[10, 0], [30, 0], [50, 10]]);
    expect(status()).toBe(BOX(380, 240));
    fireEvent.click(btn("Undo"));
    expect(status()).toBe(BOX(330)); // all the way back, and still selected
    fireEvent.click(btn("Undo"));
    expect(screen.queryByRole("button", { name: "Text box 1" })).not.toBeInTheDocument();
    expect(status()).toBeNull();
    fireEvent.click(btn("Redo"));
    fireEvent.click(btn("Redo"));
    expect(status()).toBe(BOX(380, 240));
  });

  it("two separate drags are two steps", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(hit("Text box 1"), [[20, 0], [50, 0]]);
    drag(hit("Text box 1"), [[0, 15], [0, 30]]);
    expect(status()).toBe(BOX(380, 260));
    fireEvent.click(btn("Undo"));
    expect(status()).toBe(BOX(380));
    fireEvent.click(btn("Undo"));
    expect(status()).toBe(BOX(330));
  });

  it("each tap of an arrow key is a step, but a held key is one", async () => {
    await openEditor();
    insertTextBox();
    for (let i = 0; i < 3; i++) {
      key("ArrowRight");
      fireEvent.keyUp(canvas(), { key: "ArrowRight" });
    }
    expect(status()).toBe(BOX(360));
    fireEvent.click(btn("Undo"));
    expect(status()).toBe(BOX(350));
    fireEvent.click(btn("Undo"));
    fireEvent.click(btn("Undo"));
    expect(status()).toBe(BOX(330));

    key("ArrowDown"); // held: repeated keydown events, one keyup at the end
    key("ArrowDown");
    key("ArrowDown");
    fireEvent.keyUp(canvas(), { key: "ArrowDown" });
    expect(status()).toBe(BOX(330, 260));
    fireEvent.click(btn("Undo"));
    expect(status()).toBe(BOX(330));
  });

  it("an editing session is one step; a later session is another", async () => {
    await openEditor();
    insertTextBox();
    const edit = (text: string) => {
      fireEvent.doubleClick(hit("Text box 1"));
      const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
      editor.firstElementChild!.textContent = "partial";
      fireEvent.input(editor);
      editor.firstElementChild!.textContent = text;
      fireEvent.input(editor);
      fireEvent.keyDown(editor, { key: "Escape" });
    };
    edit("Two");
    edit("Three");
    expect(panelText()).toHaveValue("Three");
    fireEvent.click(btn("Undo"));
    expect(panelText()).toHaveValue("Two");
    fireEvent.click(btn("Undo"));
    expect(panelText()).toHaveValue("Text box");
    fireEvent.click(btn("Redo"));
    expect(panelText()).toHaveValue("Two");
  });

  it("undoing while editing ends the editing and restores the text without writing it back", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
    editor.firstElementChild!.textContent = "Edited";
    fireEvent.input(editor);
    expect(panelText()).toHaveValue("Edited");
    fireEvent.click(btn("Undo"));
    expect(screen.queryByRole("textbox", { name: "Editing Text box 1" })).not.toBeInTheDocument();
    expect(panelText()).toHaveValue("Text box");
    expect(btn("Redo")).toBeEnabled(); // not overwritten by a late write from the closing editor
  });
});

describe("undoing other kinds of change", () => {
  it("restores deleted objects and their selection", async () => {
    await openEditor();
    press(hit("Title"));
    key("Delete");
    expect(screen.queryByRole("button", { name: "Title" })).not.toBeInTheDocument();
    fireEvent.click(btn("Undo"));
    expect(hit("Title")).toBeInTheDocument();
    expect(status()).toBe("Selected: Title (80, 60, 800 × 100)");
  });

  it("undoes formatting", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Bold"));
    const weight = () => document.querySelector<HTMLElement>(".viewport .slide__text--textbox")!.style.fontWeight;
    expect(weight()).toBe("700");
    fireEvent.click(btn("Undo"));
    expect(weight()).toBe("400");
    fireEvent.click(btn("Redo"));
    expect(weight()).toBe("700");
  });

  it("undoes grouping, with the same objects still selected", async () => {
    await openEditor();
    press(hit("Title"));
    press(hit("Body"), { shiftKey: true });
    fireEvent.click(btn("Group"));
    expect(status()).toMatch(/^Selected: group of 2 objects /);
    fireEvent.click(btn("Undo"));
    expect(status()).toMatch(/^Selected: 2 objects /);
    expect(btn("Group")).toBeEnabled();
  });

  it("undoes a slide being deleted", async () => {
    await openEditor();
    fireEvent.click(btn("New slide"));
    window.confirm = () => true;
    fireEvent.click(btn("Delete slide"));
    expect(screen.getByText("Slide 1 of 1")).toBeInTheDocument();
    fireEvent.click(btn("Undo"));
    expect(screen.getByText("Slide 2 of 2")).toBeInTheDocument();
  });
});

describe("persistence and accessibility", () => {
  it("an undo is autosaved", async () => {
    await openEditor();
    fireEvent.change(screen.getByRole("textbox", { name: "Presentation title" }), { target: { value: "Undo autosave" } });
    insertTextBox();
    fireEvent.click(btn("Undo"));
    await waitFor(async () => {
      const saved = (await listPresentations()).find((p) => p.title === "Undo autosave");
      expect(saved).toBeDefined();
      expect(saved!.slides[0].objects.some((o) => o.role === "textbox")).toBe(false);
    });
  });

  it("the Undo and Redo buttons have no accessibility violations", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.click(btn("New slide"));
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 100)).join(" | ")}`)).toEqual([]);
  });
});
