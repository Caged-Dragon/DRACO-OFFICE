import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TextObject } from "../../src/core/document-model/types";
import { TextEditor } from "../../src/features/canvas/TextEditor";

const obj: TextObject = {
  id: "o1",
  type: "text",
  role: "textbox",
  name: "Text box 1",
  x: 10,
  y: 20,
  width: 300,
  height: 80,
  rotation: 0,
  visible: true,
  text: "Hello\nWorld",
  fontSize: 24,
};

function setup() {
  const onTextChange = vi.fn();
  const onExit = vi.fn();
  const view = render(<TextEditor object={obj} zoom={1} caretPoint={null} onTextChange={onTextChange} onExit={onExit} />);
  const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
  return { editor, onTextChange, onExit, unmount: view.unmount };
}
const lines = (el: HTMLElement) => [...el.querySelectorAll(".rt-line")].map((l) => l.textContent);

describe("TextEditor", () => {
  it("builds the lines, takes focus and puts the caret at the end", () => {
    const { editor } = setup();
    expect(lines(editor)).toEqual(["Hello", "World"]);
    expect(editor).toHaveFocus();
    expect(editor).toHaveAttribute("aria-multiline", "true");
    const sel = document.getSelection()!;
    expect(sel.rangeCount).toBe(1);
    expect(sel.isCollapsed).toBe(true);
    expect(sel.anchorNode).toBe(editor.lastElementChild);
    expect(sel.anchorOffset).toBe(1);
  });

  it("reports typed text, but only when it changed", () => {
    const { editor, onTextChange } = setup();
    editor.lastElementChild!.textContent = "World!";
    fireEvent.input(editor);
    expect(onTextChange).toHaveBeenCalledTimes(1);
    expect(onTextChange).toHaveBeenLastCalledWith("Hello\nWorld!");
    fireEvent.input(editor);
    expect(onTextChange).toHaveBeenCalledTimes(1);
  });

  it("understands the empty line a browser adds when Enter is pressed", () => {
    const { editor, onTextChange } = setup();
    const line = document.createElement("div");
    line.appendChild(document.createElement("br"));
    editor.appendChild(line);
    fireEvent.input(editor);
    expect(onTextChange).toHaveBeenLastCalledWith("Hello\nWorld\n");
  });

  it("never re-renders the editing surface while typing", () => {
    const { editor } = setup();
    const first = editor.firstElementChild;
    editor.firstElementChild!.textContent = "Changed";
    fireEvent.input(editor);
    expect(editor.firstElementChild).toBe(first); // same node: the browser's caret and selection are untouched
  });

  it("Escape saves pending changes, exits once, and a later blur does not exit again", () => {
    const { editor, onTextChange, onExit } = setup();
    editor.lastElementChild!.textContent = "Typed without an input event";
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(onTextChange).toHaveBeenLastCalledWith("Hello\nTyped without an input event");
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith("escape");
    fireEvent.blur(editor);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("blur exits with the blur reason", () => {
    const { editor, onExit } = setup();
    fireEvent.blur(editor);
    expect(onExit).toHaveBeenCalledWith("blur");
  });

  it("keeps the last edit if it is removed without a blur", () => {
    const { editor, onTextChange, unmount } = setup();
    editor.firstElementChild!.textContent = "Last words";
    unmount();
    expect(onTextChange).toHaveBeenLastCalledWith("Last words\nWorld");
  });

  it("pastes as plain text", () => {
    const { editor, onTextChange } = setup();
    const allowed = fireEvent.paste(editor, {
      clipboardData: { getData: (type: string) => (type === "text/plain" ? "x\ny" : "<b>bold</b>") },
    });
    expect(allowed).toBe(false); // default prevented
    expect(onTextChange).toHaveBeenLastCalledWith("Hello\nWorldx\ny");
  });

  it("blocks browser formatting commands and drops", () => {
    const { editor } = setup();
    const bold = new Event("beforeinput", { cancelable: true });
    Object.defineProperty(bold, "inputType", { value: "formatBold" });
    editor.dispatchEvent(bold);
    expect(bold.defaultPrevented).toBe(true);
    const typing = new Event("beforeinput", { cancelable: true });
    Object.defineProperty(typing, "inputType", { value: "insertText" });
    editor.dispatchEvent(typing);
    expect(typing.defaultPrevented).toBe(false);
    expect(fireEvent.drop(editor)).toBe(false);
  });

  it("starts with a different line structure for an empty object", () => {
    const view = render(<TextEditor object={{ ...obj, name: "Empty", text: "" }} zoom={2} caretPoint={null} onTextChange={vi.fn()} onExit={vi.fn()} />);
    const editor = screen.getByRole("textbox", { name: "Editing Empty" });
    expect(editor.querySelectorAll(".rt-line")).toHaveLength(1);
    expect(editor.querySelector("br")).not.toBeNull();
    expect(editor.style.transform).toBe("scale(2)");
    view.unmount();
  });
});
