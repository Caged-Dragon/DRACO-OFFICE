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
const title = () => within(canvas()).getByRole("img").querySelector<HTMLElement>(".slide__text--title")!;
const control = (name: string) => screen.getByRole("button", { name });
const hit = (name: string) => screen.getByRole("button", { name });

describe("text formatting controls", () => {
  it("are disabled until a text object is selected, then reflect its formatting", async () => {
    await openEditor();
    for (const name of ["Bold", "Italic", "Underline", "Strikethrough", "Increase font size", "Decrease font size"]) {
      expect(control(name)).toBeDisabled();
    }
    expect(screen.getByRole("combobox", { name: "Font family" })).toBeDisabled();
    expect(screen.getByLabelText("Text color")).toBeDisabled();
    fireEvent.mouseDown(hit("Title"), { button: 0, clientX: 1, clientY: 1 });
    fireEvent.mouseUp(window);
    expect(control("Bold")).toBeEnabled();
    expect(control("Bold")).toHaveAttribute("aria-pressed", "true"); // titles start bold
    expect(control("Italic")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("spinbutton", { name: "Font size" })).toHaveValue(44);
    expect(screen.getByRole("combobox", { name: "Font family" })).toHaveValue("Segoe UI");
    expect(screen.getByLabelText("Text color")).toHaveValue("#1d1d1d");
  });

  it("bold, italic, underline and strikethrough toggle on the canvas and in the thumbnail", async () => {
    await openEditor();
    insertTextBox();
    expect(box().style.fontWeight).toBe("400");
    fireEvent.click(control("Bold"));
    expect(box().style.fontWeight).toBe("700");
    expect(control("Bold")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(control("Italic"));
    expect(box().style.fontStyle).toBe("italic");
    fireEvent.click(control("Underline"));
    expect(box().style.textDecoration).toContain("underline");
    fireEvent.click(control("Strikethrough"));
    expect(box().style.textDecoration).toContain("line-through");
    expect(box().style.textDecoration).toContain("underline");
    const thumb = within(screen.getByRole("navigation", { name: "Slides" })).getAllByText("Text box")[0].closest<HTMLElement>(".slide__text")!;
    expect(thumb.style.fontWeight).toBe("700");
    fireEvent.click(control("Bold"));
    expect(box().style.fontWeight).toBe("400");
  });

  it("the title can be un-bolded", async () => {
    await openEditor();
    fireEvent.mouseDown(hit("Title"), { button: 0, clientX: 1, clientY: 1 });
    fireEvent.mouseUp(window);
    expect(title().style.fontWeight).toBe("700");
    fireEvent.click(control("Bold"));
    expect(title().style.fontWeight).toBe("400");
  });

  it("changes the font family", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.change(screen.getByRole("combobox", { name: "Font family" }), { target: { value: "Georgia" } });
    expect(box().style.fontFamily).toContain("Georgia");
  });

  it("sets the font size by typing, and steps it with A+ and A-", async () => {
    await openEditor();
    insertTextBox();
    const size = () => screen.getByRole("spinbutton", { name: "Font size" });
    fireEvent.change(size(), { target: { value: "36" } });
    fireEvent.blur(size());
    expect(box().style.fontSize).toBe("36px");
    fireEvent.click(control("Increase font size"));
    expect(box().style.fontSize).toBe("40px");
    fireEvent.click(control("Decrease font size"));
    fireEvent.click(control("Decrease font size"));
    expect(box().style.fontSize).toBe("32px");
    expect(size()).toHaveValue(32);
  });

  it("clamps an out-of-range size and restores the field when the entry is not a number", async () => {
    await openEditor();
    insertTextBox();
    const size = () => screen.getByRole("spinbutton", { name: "Font size" });
    fireEvent.change(size(), { target: { value: "9999" } });
    fireEvent.blur(size());
    expect(box().style.fontSize).toBe("400px");
    expect(size()).toHaveValue(400);
    fireEvent.change(size(), { target: { value: "" } });
    fireEvent.blur(size());
    expect(box().style.fontSize).toBe("400px");
    expect(size()).toHaveValue(400);
  });

  it("changes the text color", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.change(screen.getByLabelText("Text color"), { target: { value: "#ff0000" } });
    expect(box()).toHaveStyle({ color: "#ff0000" });
  });

  it("Ctrl+B, Ctrl+I and Ctrl+U format the selected object from the canvas", async () => {
    await openEditor();
    insertTextBox();
    canvas().focus();
    fireEvent.keyDown(canvas(), { key: "b", ctrlKey: true });
    fireEvent.keyDown(canvas(), { key: "I", metaKey: true });
    fireEvent.keyDown(canvas(), { key: "u", ctrlKey: true });
    expect(box().style.fontWeight).toBe("700");
    expect(box().style.fontStyle).toBe("italic");
    expect(box().style.textDecoration).toContain("underline");
    fireEvent.keyDown(canvas(), { key: "b", ctrlKey: true });
    expect(box().style.fontWeight).toBe("400");
  });

  it("formatting keeps the editor and its caret: the editing DOM is not replaced", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
    const firstLine = editor.firstElementChild;
    fireEvent.click(control("Bold"));
    fireEvent.click(control("Underline"));
    fireEvent.change(screen.getByLabelText("Text color"), { target: { value: "#0000ff" } });
    const same = screen.getByRole("textbox", { name: "Editing Text box 1" });
    expect(same).toBe(editor);
    expect(same.firstElementChild).toBe(firstLine);
    expect(same.style.fontWeight).toBe("700");
    expect(same.style.textDecoration).toContain("underline");
    expect(same).toHaveStyle({ color: "#0000ff" });
  });

  it("Ctrl+B inside the editor toggles bold instead of the browser inserting <b>", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
    const ev = new Event("beforeinput", { cancelable: true, bubbles: true });
    Object.defineProperty(ev, "inputType", { value: "formatBold" });
    editor.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    await waitFor(() => expect(editor.style.fontWeight).toBe("700"));
    expect(editor.querySelector("b, strong")).toBeNull();
  });

  it("formatting is autosaved", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(control("Italic"));
    fireEvent.change(screen.getByRole("combobox", { name: "Font family" }), { target: { value: "Courier New" } });
    await waitFor(async () => {
      const list = await listPresentations();
      expect(list.some((p) => p.slides[0].objects.some((o) => o.role === "textbox" && o.italic && o.fontFamily === "Courier New"))).toBe(true);
    });
  });

  it("the Font group has no accessibility violations with an object selected", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.mouseDown(hit("Title"), { button: 0, clientX: 1, clientY: 1 });
    fireEvent.mouseUp(window);
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 100)).join(" | ")}`)).toEqual([]);
  });
});
