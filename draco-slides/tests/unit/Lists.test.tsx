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
const canvas = () => screen.getByRole("group", { name: "Slide canvas" });
const box = () => within(canvas()).getByRole("img").querySelector<HTMLElement>(".slide__text--textbox")!;
const btn = (name: string) => screen.getByRole("button", { name });
const panelText = () => screen.getByRole("textbox", { name: "Text box 1" });
const setText = (text: string) => fireEvent.change(panelText(), { target: { value: text } });
const levels = () => [...box().querySelectorAll(".rt-line")].map((l) => l.getAttribute("data-level"));

describe("lists", () => {
  it("list controls are disabled without a selected text object; levels also need a list", async () => {
    await openEditor();
    for (const n of ["Bullets", "Numbering", "Increase list level", "Decrease list level"]) expect(btn(n), n).toBeDisabled();
    insertTextBox();
    expect(btn("Bullets")).toBeEnabled();
    expect(btn("Numbering")).toBeEnabled();
    expect(btn("Increase list level")).toBeDisabled(); // no list yet
    expect(btn("Decrease list level")).toBeDisabled();
  });

  it("Bullets and Numbering switch the list on the canvas and in the thumbnail, and toggle off", async () => {
    await openEditor();
    insertTextBox();
    expect(box().classList.contains("rt-list")).toBe(false);
    fireEvent.click(btn("Bullets"));
    expect(box().classList.contains("rt-list--bullet")).toBe(true);
    expect(btn("Bullets")).toHaveAttribute("aria-pressed", "true");
    expect(btn("Numbering")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn("Numbering"));
    expect(box().classList.contains("rt-list--number")).toBe(true);
    expect(box().classList.contains("rt-list--bullet")).toBe(false);
    expect(btn("Numbering")).toHaveAttribute("aria-pressed", "true");
    const thumb = within(screen.getByRole("navigation", { name: "Slides" })).getAllByText("Text box")[0].closest(".slide__text")!;
    expect(thumb.classList.contains("rt-list--number")).toBe(true);
    fireEvent.click(btn("Numbering"));
    expect(box().classList.contains("rt-list")).toBe(false);
    expect(btn("Numbering")).toHaveAttribute("aria-pressed", "false");
  });

  it("every paragraph of the object gets a line, and outline levels show as data-level", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Bullets"));
    setText("one\n\ttwo\n\t\tthree");
    expect(levels()).toEqual([null, "1", "2"]);
    expect([...box().querySelectorAll(".rt-line")].map((l) => l.textContent)).toEqual(["one", "two", "three"]);
  });

  it("level buttons move every paragraph when the object is selected, and stop at the ends", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Numbering"));
    setText("a\nb");
    expect(btn("Decrease list level")).toBeDisabled();
    fireEvent.click(btn("Increase list level"));
    expect(panelText()).toHaveValue("\ta\n\tb");
    expect(levels()).toEqual(["1", "1"]);
    expect(btn("Decrease list level")).toBeEnabled();
    fireEvent.click(btn("Decrease list level"));
    expect(panelText()).toHaveValue("a\nb");
    for (let i = 0; i < 8; i++) fireEvent.click(btn("Increase list level"));
    expect(btn("Increase list level")).toBeDisabled();
    expect(levels()).toEqual(["8", "8"]);
  });

  it("while editing, the level buttons change only the paragraph with the caret", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Bullets"));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Text box 1" }));
    const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
    editor.innerHTML = '<div class="rt-line">a</div><div class="rt-line">b</div>';
    fireEvent.input(editor);
    const range = document.createRange();
    range.selectNodeContents(editor.children[0]);
    range.collapse(false);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    fireEvent.click(btn("Increase list level"));
    expect(screen.getByRole("textbox", { name: "Editing Text box 1" })).toBe(editor); // surface untouched
    expect(editor.children[0].getAttribute("data-level")).toBe("1");
    expect(editor.children[1].getAttribute("data-level")).toBeNull();
    expect(panelText()).toHaveValue("\ta\nb");
  });

  it("Tab and Shift+Tab inside the editor change the level instead of leaving it", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Bullets"));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Text box 1" }));
    const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(false);
    expect(panelText()).toHaveValue("\tText box");
    fireEvent.keyDown(editor, { key: "Tab", shiftKey: true });
    expect(panelText()).toHaveValue("Text box");
    expect(screen.getByRole("textbox", { name: "Editing Text box 1" })).toBe(editor);
  });

  it("the editor surface carries the list style so markers show while typing", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Numbering"));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Text box 1" }));
    const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
    expect(editor.classList.contains("rt-list--number")).toBe(true);
  });

  it("lists and levels are autosaved", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Bullets"));
    setText("a\n\tb");
    await waitFor(async () => {
      const list = await listPresentations();
      expect(list.some((p) => p.slides[0].objects.some((o) => o.role === "textbox" && o.list === "bullet" && o.text === "a\n\tb"))).toBe(true);
    });
  });

  it("the List group has no accessibility violations", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Body" }), { button: 0, clientX: 1, clientY: 1 });
    fireEvent.mouseUp(window);
    fireEvent.click(screen.getByRole("button", { name: "Bullets" }));
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 100)).join(" | ")}`)).toEqual([]);
  });
});
