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
};
const canvas = () => screen.getByRole("group", { name: "Slide canvas" });
const hit = (name: string) => screen.getByRole("button", { name });
const editor = (name = "Text box 1") => screen.getByRole("textbox", { name: `Editing ${name}` });
const queryEditor = (name = "Text box 1") => screen.queryByRole("textbox", { name: `Editing ${name}` });
const panelField = (name = "Text box 1") => screen.getByRole("textbox", { name });
const type = (el: HTMLElement, text: string) => {
  el.firstElementChild!.textContent = text;
  fireEvent.input(el);
};
const status = () => screen.queryByText(/^Selected: /)?.textContent ?? null;

describe("editing text in place", () => {
  it("double-click opens the editor over the object, with focus, and hides the handles", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"), { clientX: 400, clientY: 300 });
    expect(editor()).toHaveFocus();
    expect(editor().querySelector(".rt-line")!.textContent).toBe("Text box");
    expect(screen.queryByRole("button", { name: "Text box 1" })).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(/^handle-/)).toHaveLength(0);
    expect(status()).toBe("Selected: Text box 1 (330, 230, 300 × 80) – editing text");
  });

  it("typing updates the document, the Text panel and the thumbnail live", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    type(editor(), "Hello");
    expect(panelField()).toHaveValue("Hello");
    expect(within(screen.getByRole("navigation", { name: "Slides" })).getByText("Hello")).toBeInTheDocument();
  });

  it("multi-line text round-trips between the editor, the model and the canvas", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    editor().innerHTML = "<div>a</div><div><br></div><div>b</div>";
    fireEvent.input(editor());
    expect(panelField()).toHaveValue("a\n\nb");
    fireEvent.keyDown(editor(), { key: "Escape" });
    const lines = [...within(canvas()).getByRole("img").querySelectorAll(".slide__text--textbox .rt-line")];
    expect(lines.map((l) => l.textContent)).toEqual(["a", "", "b"]);
  });

  it("Escape finishes editing, keeps the object selected and returns focus to the canvas", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    type(editor(), "Done");
    fireEvent.keyDown(editor(), { key: "Escape" });
    expect(queryEditor()).not.toBeInTheDocument();
    expect(hit("Text box 1")).toHaveAttribute("aria-pressed", "true");
    expect(canvas()).toHaveFocus();
    expect(status()).toBe("Selected: Text box 1 (330, 230, 300 × 80)");
    expect(panelField()).toHaveValue("Done");
  });

  it("Enter or F2 on a selected text object starts editing; Enter with nothing selected does nothing", async () => {
    await openEditor();
    canvas().focus();
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(screen.queryByRole("textbox", { name: /^Editing / })).not.toBeInTheDocument();
    insertTextBox();
    fireEvent.keyDown(canvas(), { key: "Enter" });
    expect(editor()).toBeInTheDocument();
    fireEvent.keyDown(editor(), { key: "Escape" });
    fireEvent.keyDown(canvas(), { key: "F2" });
    expect(editor()).toBeInTheDocument();
  });

  it("Home > Edit text starts editing and is disabled without a selection", async () => {
    await openEditor();
    const edit = screen.getByRole("button", { name: "Edit text" });
    expect(edit).toBeDisabled();
    insertTextBox();
    fireEvent.click(screen.getByRole("tab", { name: "Home" }));
    expect(screen.getByRole("button", { name: "Edit text" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit text" }));
    expect(editor()).toBeInTheDocument();
  });

  it("placeholders can be edited too", async () => {
    await openEditor();
    fireEvent.doubleClick(hit("Title"));
    expect(editor("Title").querySelector(".rt-line")!.textContent).toBe("Untitled presentation");
  });

  it("keys typed in the editor do not trigger canvas shortcuts or slide navigation", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Slides" })).getByRole("button", { name: /^Slide 1:/ }));
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    const zoomBefore = screen.getByText(/^Zoom \d+%$/).textContent;
    fireEvent.keyDown(editor(), { key: " " });
    fireEvent.keyDown(editor(), { key: "+" });
    fireEvent.keyDown(editor(), { key: "Delete" });
    fireEvent.keyDown(editor(), { key: "PageDown" });
    expect(canvas().className).not.toContain("viewport--pan");
    expect(screen.getByText(/^Zoom \d+%$/).textContent).toBe(zoomBefore);
    expect(editor()).toBeInTheDocument(); // Delete did not delete the object
    expect(screen.getByText("Slide 1 of 2")).toBeInTheDocument();
  });

  it("clicking empty canvas finishes editing and keeps the typed text, even without an input event", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    editor().firstElementChild!.textContent = "Unsaved by input event";
    fireEvent.mouseDown(canvas(), { button: 0, clientX: 5, clientY: 5 });
    expect(queryEditor()).not.toBeInTheDocument();
    expect(status()).toBeNull();
    expect(panelField()).toHaveValue("Unsaved by input event");
  });

  it("clicking another object finishes editing and selects that object", async () => {
    await openEditor();
    insertTextBox();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    fireEvent.mouseDown(hit("Text box 2"), { button: 0, clientX: 1, clientY: 1 });
    fireEvent.mouseUp(window);
    expect(queryEditor()).not.toBeInTheDocument();
    expect(status()).toMatch(/^Selected: Text box 2 /);
    expect(status()).not.toContain("editing");
  });

  it("switching slides ends editing", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    fireEvent.click(screen.getByRole("tab", { name: "Home" }));
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    expect(queryEditor()).not.toBeInTheDocument();
  });

  it("edited text is autosaved", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    type(editor(), "Persisted text");
    fireEvent.keyDown(editor(), { key: "Escape" });
    await waitFor(async () => {
      const list = await listPresentations();
      expect(list.some((p) => p.slides[0].objects.some((o) => o.text === "Persisted text"))).toBe(true);
    });
  });

  it("announces editing to screen readers", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    expect(screen.getByText("Editing Text box 1. Press Escape to finish.")).toBeInTheDocument();
  });

  it("the editing state has no accessibility violations", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    insertTextBox();
    fireEvent.doubleClick(hit("Text box 1"));
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 100)).join(" | ")}`)).toEqual([]);
  });
});
