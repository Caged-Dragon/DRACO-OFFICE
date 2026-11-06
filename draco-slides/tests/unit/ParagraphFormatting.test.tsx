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
const spacing = () => screen.getByRole("combobox", { name: "Line spacing" });

describe("paragraph controls", () => {
  it("are disabled until a text object is selected, then show its settings", async () => {
    await openEditor();
    for (const n of ["Align left", "Center", "Align right", "Justify", "Decrease indent", "Increase indent", "Left-to-right", "Right-to-left"]) {
      expect(btn(n), n).toBeDisabled();
    }
    expect(spacing()).toBeDisabled();
    insertTextBox();
    expect(btn("Align left")).toHaveAttribute("aria-pressed", "true");
    expect(btn("Center")).toHaveAttribute("aria-pressed", "false");
    expect(btn("Left-to-right")).toHaveAttribute("aria-pressed", "true");
    expect(spacing()).toHaveValue("1.2");
    expect(btn("Decrease indent")).toBeDisabled();
    expect(btn("Increase indent")).toBeEnabled();
  });

  it("alignment changes the canvas and the thumbnail, and exactly one button is pressed", async () => {
    await openEditor();
    insertTextBox();
    for (const [name, css] of [["Center", "center"], ["Align right", "right"], ["Justify", "justify"], ["Align left", "left"]] as const) {
      fireEvent.click(btn(name));
      expect(box().style.textAlign, name).toBe(css);
      expect(btn(name)).toHaveAttribute("aria-pressed", "true");
      expect(screen.getAllByRole("button", { pressed: true }).filter((b) => ["Align left", "Center", "Align right", "Justify"].includes(b.getAttribute("aria-label") ?? ""))).toHaveLength(1);
    }
    fireEvent.click(btn("Center"));
    const thumb = within(screen.getByRole("navigation", { name: "Slides" })).getAllByText("Text box")[0].closest<HTMLElement>(".slide__text")!;
    expect(thumb.style.textAlign).toBe("center");
  });

  it("indent steps by levels, pads the text, and stops at both ends", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Increase indent"));
    fireEvent.click(btn("Increase indent"));
    expect(box().style.paddingLeft).toBe("72px");
    fireEvent.click(btn("Decrease indent"));
    expect(box().style.paddingLeft).toBe("36px");
    fireEvent.click(btn("Decrease indent"));
    expect(btn("Decrease indent")).toBeDisabled();
    expect(box().style.paddingLeft).toBe("");
    for (let i = 0; i < 8; i++) fireEvent.click(btn("Increase indent"));
    expect(btn("Increase indent")).toBeDisabled();
    expect(box().style.paddingLeft).toBe("288px");
  });

  it("line spacing changes the line height; an unusual stored value stays selectable", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.change(spacing(), { target: { value: "2" } });
    expect(box().style.lineHeight).toBe("2");
    expect(spacing()).toHaveValue("2");
    expect(within(spacing()).getAllByRole("option").map((o) => o.textContent)).toEqual(["1.0", "1.2", "1.5", "2.0", "2.5", "3.0"]);
  });

  it("right-to-left sets the dir attribute, mirrors the alignment and moves the indent side", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Increase indent"));
    fireEvent.click(btn("Right-to-left"));
    expect(box().getAttribute("dir")).toBe("rtl");
    expect(box().style.textAlign).toBe("right");
    expect(box().style.paddingRight).toBe("36px");
    expect(box().style.paddingLeft).toBe("");
    expect(btn("Right-to-left")).toHaveAttribute("aria-pressed", "true");
    expect(btn("Align right")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(btn("Left-to-right"));
    expect(box().getAttribute("dir")).toBe("ltr");
    expect(box().style.textAlign).toBe("left");
    expect(box().style.paddingLeft).toBe("36px");
  });

  it("Ctrl+E, Ctrl+R, Ctrl+J and Ctrl+L align the selected object from the canvas", async () => {
    await openEditor();
    insertTextBox();
    canvas().focus();
    fireEvent.keyDown(canvas(), { key: "e", ctrlKey: true });
    expect(box().style.textAlign).toBe("center");
    fireEvent.keyDown(canvas(), { key: "r", ctrlKey: true });
    expect(box().style.textAlign).toBe("right");
    fireEvent.keyDown(canvas(), { key: "J", metaKey: true });
    expect(box().style.textAlign).toBe("justify");
    fireEvent.keyDown(canvas(), { key: "l", ctrlKey: true });
    expect(box().style.textAlign).toBe("left");
  });

  it("while editing, settings apply to the editor without replacing its text", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(screen.getByRole("button", { name: "Text box 1" }));
    const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
    const firstLine = editor.firstElementChild;
    fireEvent.click(btn("Center"));
    fireEvent.click(btn("Increase indent"));
    fireEvent.click(btn("Right-to-left"));
    expect(screen.getByRole("textbox", { name: "Editing Text box 1" })).toBe(editor);
    expect(editor.firstElementChild).toBe(firstLine);
    expect(editor.style.textAlign).toBe("center");
    expect(editor.style.paddingRight).toBe("36px");
    expect(editor.getAttribute("dir")).toBe("rtl");
  });

  it("Ctrl+E inside the editor aligns the object instead of the browser doing it", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(screen.getByRole("button", { name: "Text box 1" }));
    const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
    const ev = new Event("beforeinput", { cancelable: true, bubbles: true });
    Object.defineProperty(ev, "inputType", { value: "formatJustifyCenter" });
    editor.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    await waitFor(() => expect(editor.style.textAlign).toBe("center"));
  });

  it("settings are autosaved", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Justify"));
    fireEvent.click(btn("Increase indent"));
    fireEvent.change(spacing(), { target: { value: "1.5" } });
    await waitFor(async () => {
      const list = await listPresentations();
      expect(list.some((p) => p.slides[0].objects.some((o) => o.role === "textbox" && o.align === "justify" && o.indent === 1 && o.lineSpacing === 1.5))).toBe(true);
    });
  });

  it("the Paragraph group has no accessibility violations with an object selected", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Title" }), { button: 0, clientX: 1, clientY: 1 });
    fireEvent.mouseUp(window);
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 100)).join(" | ")}`)).toEqual([]);
  });
});
