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
  groupId: null,
  locked: false,
  text: "Hello\nWorld",
  fontFamily: "Segoe UI",
  fontSize: 24,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  color: "#1d1d1d",
  align: "left",
  indent: 0,
  lineSpacing: 1.2,
  direction: "ltr",
  list: "none",
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
  verticalAlign: "top",
  overflow: "hidden",
};

function setup() {
  const onTextChange = vi.fn();
  const onExit = vi.fn();
  const onToggleFormat = vi.fn();
  const onAlign = vi.fn();
  const view = render(
    <TextEditor object={obj} zoom={1} caretPoint={null} onTextChange={onTextChange} onExit={onExit} onToggleFormat={onToggleFormat} onAlign={onAlign} />,
  );
  const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
  return { editor, onTextChange, onExit, onToggleFormat, onAlign, unmount: view.unmount };
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

  it("routes Ctrl+B / I / U / strikethrough to the object's formatting instead of the browser's", () => {
    const { editor, onToggleFormat } = setup();
    const fire = (inputType: string) => {
      const ev = new Event("beforeinput", { cancelable: true });
      Object.defineProperty(ev, "inputType", { value: inputType });
      editor.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    expect(fire("formatBold")).toBe(true);
    expect(fire("formatItalic")).toBe(true);
    expect(fire("formatUnderline")).toBe(true);
    expect(fire("formatStrikeThrough")).toBe(true);
    expect(onToggleFormat.mock.calls.map((c) => c[0])).toEqual(["bold", "italic", "underline", "strike"]);
    expect(fire("formatJustifyCenter")).toBe(true); // other formatting is ignored, not applied by the browser
    expect(onToggleFormat).toHaveBeenCalledTimes(4);
  });

  it("routes Ctrl+L / E / R / J to the object's alignment", () => {
    const { editor, onAlign } = setup();
    for (const t of ["formatJustifyLeft", "formatJustifyCenter", "formatJustifyRight", "formatJustifyFull"]) {
      const ev = new Event("beforeinput", { cancelable: true });
      Object.defineProperty(ev, "inputType", { value: t });
      editor.dispatchEvent(ev);
      expect(ev.defaultPrevented, t).toBe(true);
    }
    expect(onAlign.mock.calls.map((c) => c[0])).toEqual(["left", "center", "right", "justify"]);
  });

  it("applies paragraph settings and direction to the editing surface", () => {
    const view = render(
      <TextEditor
        object={{ ...obj, name: "Para", align: "center", indent: 2, lineSpacing: 1.5, direction: "rtl" }}
        zoom={1}
        caretPoint={null}
        onTextChange={vi.fn()}
        onExit={vi.fn()}
        onToggleFormat={vi.fn()}
        onAlign={vi.fn()}
      />,
    );
    const el = screen.getByRole("textbox", { name: "Editing Para" });
    expect(el.getAttribute("dir")).toBe("rtl");
    expect(el.style.textAlign).toBe("center");
    expect(el.style.lineHeight).toBe("1.5");
    expect(el.style.paddingRight).toBe("72px");
    expect(el.style.paddingLeft).toBe("");
    view.unmount();
  });

  it("applies margins, vertical alignment and overflow to the editing surface", () => {
    const view = render(
      <TextEditor
        object={{ ...obj, name: "Box", margins: { top: 4, right: 8, bottom: 6, left: 10 }, verticalAlign: "middle", overflow: "visible" }}
        zoom={1}
        caretPoint={null}
        onTextChange={vi.fn()}
        onExit={vi.fn()}
        onToggleFormat={vi.fn()}
        onAlign={vi.fn()}
      />,
    );
    const el = screen.getByRole("textbox", { name: "Editing Box" });
    expect([el.style.paddingTop, el.style.paddingRight, el.style.paddingBottom, el.style.paddingLeft]).toEqual(["4px", "8px", "6px", "10px"]);
    expect(el.classList.contains("rt-v--middle")).toBe(true);
    expect(el.classList.contains("rt-overflow--visible")).toBe(true);
    view.unmount();
  });

  it("applies the object's formatting to the editing surface", () => {
    const view = render(
      <TextEditor
        object={{ ...obj, name: "Styled", fontFamily: "Georgia", fontSize: 40, bold: true, italic: true, underline: true, strike: true, color: "#ff0000" }}
        zoom={1}
        caretPoint={null}
        onTextChange={vi.fn()}
        onExit={vi.fn()}
        onToggleFormat={vi.fn()}
        onAlign={vi.fn()}
      />,
    );
    const el = screen.getByRole("textbox", { name: "Editing Styled" });
    expect(el.style.fontFamily).toContain("Georgia");
    expect(el.style.fontSize).toBe("40px");
    expect(el.style.fontWeight).toBe("700");
    expect(el.style.fontStyle).toBe("italic");
    expect(el.style.textDecoration).toContain("underline");
    expect(el.style.textDecoration).toContain("line-through");
    expect(el).toHaveStyle({ color: "#ff0000" });
    view.unmount();
  });

  it("blocks drops and ordinary typing is left alone", () => {
    const { editor } = setup();
    const typing = new Event("beforeinput", { cancelable: true });
    Object.defineProperty(typing, "inputType", { value: "insertText" });
    editor.dispatchEvent(typing);
    expect(typing.defaultPrevented).toBe(false);
    expect(fireEvent.drop(editor)).toBe(false);
  });

  it("starts with a different line structure for an empty object", () => {
    const view = render(<TextEditor object={{ ...obj, name: "Empty", text: "" }} zoom={2} caretPoint={null} onTextChange={vi.fn()} onExit={vi.fn()} onToggleFormat={vi.fn()} onAlign={vi.fn()} />);
    const editor = screen.getByRole("textbox", { name: "Editing Empty" });
    expect(editor.querySelectorAll(".rt-line")).toHaveLength(1);
    expect(editor.querySelector("br")).not.toBeNull();
    expect(editor.style.transform).toBe("scale(2)");
    view.unmount();
  });

  describe("list levels", () => {
    const listObj = { ...obj, name: "List", list: "bullet" as const, text: "one\ntwo\nthree" };
    const setupList = (over: Partial<typeof listObj> = {}) => {
      const onTextChange = vi.fn();
      let api: import("../../src/features/canvas/TextEditor").TextEditorApi | null = null;
      const view = render(
        <TextEditor
          object={{ ...listObj, ...over }}
          zoom={1}
          caretPoint={null}
          onTextChange={onTextChange}
          onExit={vi.fn()}
          onToggleFormat={vi.fn()}
          onAlign={vi.fn()}
          registerApi={(a) => {
            api = a;
          }}
        />,
      );
      const editor = screen.getByRole("textbox", { name: "Editing List" });
      return { editor, onTextChange, getApi: () => api, view };
    };
    const levels = (el: HTMLElement) => [...el.querySelectorAll(".rt-line")].map((l) => l.getAttribute("data-level"));

    it("gives the editing surface the list class", () => {
      const { editor } = setupList();
      expect(editor.classList.contains("rt-list")).toBe(true);
      expect(editor.classList.contains("rt-list--bullet")).toBe(true);
    });

    it("Tab indents the paragraph with the caret and Shift+Tab brings it back", () => {
      const { editor, onTextChange } = setupList(); // caret starts at the end: the last line
      const allowed = fireEvent.keyDown(editor, { key: "Tab" });
      expect(allowed).toBe(false); // default prevented: focus stays in the editor
      expect(levels(editor)).toEqual([null, null, "1"]);
      expect(onTextChange).toHaveBeenLastCalledWith("one\ntwo\n\tthree");
      fireEvent.keyDown(editor, { key: "Tab" });
      expect(onTextChange).toHaveBeenLastCalledWith("one\ntwo\n\t\tthree");
      fireEvent.keyDown(editor, { key: "Tab", shiftKey: true });
      fireEvent.keyDown(editor, { key: "Tab", shiftKey: true });
      expect(levels(editor)).toEqual([null, null, null]);
      expect(onTextChange).toHaveBeenLastCalledWith("one\ntwo\nthree");
    });

    it("only the lines touched by the selection change level", () => {
      const { editor, onTextChange } = setupList();
      const range = document.createRange();
      range.setStart(editor.children[0].firstChild!, 1);
      range.setEnd(editor.children[1].firstChild!, 2);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
      fireEvent.keyDown(editor, { key: "Tab" });
      expect(levels(editor)).toEqual(["1", "1", null]);
      expect(onTextChange).toHaveBeenLastCalledWith("\tone\n\ttwo\nthree");
    });

    it("never goes above the maximum or below zero", () => {
      const { editor } = setupList({ text: "only" });
      for (let i = 0; i < 12; i++) fireEvent.keyDown(editor, { key: "Tab" });
      expect(levels(editor)).toEqual(["8"]);
      for (let i = 0; i < 12; i++) fireEvent.keyDown(editor, { key: "Tab", shiftKey: true });
      expect(levels(editor)).toEqual([null]);
    });

    it("the API changes the levels of the selected lines, or all lines when there is no selection", () => {
      const { editor, onTextChange, getApi } = setupList();
      document.getSelection()!.removeAllRanges();
      getApi()!.changeLevel(1);
      expect(levels(editor)).toEqual(["1", "1", "1"]);
      expect(onTextChange).toHaveBeenLastCalledWith("\tone\n\ttwo\n\tthree");
    });

    it("an empty leveled line keeps its level", () => {
      const { editor, onTextChange } = setupList({ text: "a\n" });
      fireEvent.keyDown(editor, { key: "Tab" }); // caret is on the empty last line
      expect(levels(editor)).toEqual([null, "1"]);
      expect(onTextChange).toHaveBeenLastCalledWith("a\n\t");
    });

    it("Tab is left alone when the object is not a list, and with Ctrl/Alt/Meta", () => {
      const { editor, onTextChange } = setupList({ list: "none" });
      expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(true);
      expect(onTextChange).not.toHaveBeenCalled();
      const bullet = setupList();
      expect(fireEvent.keyDown(bullet.editor, { key: "Tab", ctrlKey: true })).toBe(true);
      expect(levels(bullet.editor)).toEqual([null, null, null]);
    });

    it("registers its API while mounted and clears it when removed", () => {
      const { getApi, view } = setupList();
      expect(getApi()).not.toBeNull();
      view.unmount();
      expect(getApi()).toBeNull();
    });
  });
});

