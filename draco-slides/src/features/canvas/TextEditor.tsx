import { useEffect, useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import type { Alignment, TextObject } from "../../core/document-model/types";
import type { Point } from "../../core/geometry/viewport";
import { clampLevel } from "../../core/document-model/lists";
import { textClassNames, textStyle } from "../editor/textStyle";
import { domToText, insertTextAtSelection, placeCaret, textToDom } from "./textDom";

export type EditExitReason = "escape" | "blur" | "click";
/** What the ribbon can ask the editing surface to do while editing is in progress. */
export interface TextEditorApi {
  /** Moves the paragraphs touched by the selection (or all of them if there is none) up or down one list level. */
  changeLevel: (delta: 1 | -1) => void;
}

export type FormatToggle = "bold" | "italic" | "underline" | "strike";

const FORMAT_INPUT_TYPES: Record<string, FormatToggle> = {
  formatBold: "bold",
  formatItalic: "italic",
  formatUnderline: "underline",
  formatStrikeThrough: "strike",
};

const ALIGN_INPUT_TYPES: Record<string, Alignment> = {
  formatJustifyLeft: "left",
  formatJustifyCenter: "center",
  formatJustifyRight: "right",
  formatJustifyFull: "justify",
};

interface Props {
  object: TextObject;
  zoom: number;
  /** Where the user double-clicked (client coordinates); the caret goes there, otherwise to the end. */
  caretPoint: Point | null;
  onTextChange: (text: string) => void;
  onExit: (reason: EditExitReason) => void;
  /** Ctrl+B / I / U in the editor: formats the whole text object (see docs/features/text-formatting.md). */
  onToggleFormat: (key: FormatToggle) => void;
  /** Ctrl+L / E / R / J in the editor. */
  onAlign: (align: Alignment) => void;
  /** Receives the editor's API while it is mounted, and null when it is removed. */
  registerApi?: (api: TextEditorApi | null) => void;
}

/**
 * In-place editor for one text object.
 *
 * The editing surface is a contenteditable whose DOM is built once and then left entirely to the browser, so
 * the caret, selection, IME composition and native undo behave exactly as users expect. React never re-renders
 * its children. Each input event reads the DOM back into plain text and reports it to the document.
 */
export function TextEditor({ object, zoom, caretPoint, onTextChange, onExit, onToggleFormat, onAlign, registerApi }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastText = useRef(object.text);
  const exited = useRef(false);
  const callbacks = useRef({ onTextChange, onExit, onToggleFormat, onAlign });
  callbacks.current = { onTextChange, onExit, onToggleFormat, onAlign };

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const text = domToText(el);
    if (text !== lastText.current) {
      lastText.current = text;
      callbacks.current.onTextChange(text);
    }
  };

  const changeLevel = (delta: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const lines = [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.tagName === "DIV");
    const range = document.getSelection()?.rangeCount ? document.getSelection()!.getRangeAt(0) : null;
    const touched = range && el.contains(range.startContainer) ? lines.filter((l) => range.intersectsNode(l)) : [];
    for (const line of touched.length ? touched : lines) {
      const next = clampLevel((Number(line.getAttribute("data-level")) || 0) + delta);
      if (next > 0) line.setAttribute("data-level", String(next));
      else line.removeAttribute("data-level");
    }
    commit();
  };
  const changeLevelRef = useRef(changeLevel);
  changeLevelRef.current = changeLevel;

  useEffect(() => {
    registerApi?.({ changeLevel: (d) => changeLevelRef.current(d) });
    return () => registerApi?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren(textToDom(object.text, document));
    el.focus();
    placeCaret(el, caretPoint);
    return () => {
      // Safety net: if the editor is removed without a blur (for example by a click handler), keep the last edit.
      commit();
    };
    // Runs once per editing session; later model updates come from this editor itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The browser must never insert its own <b>, <i> or styled spans. Formatting shortcuts are routed to the
  // text object's formatting instead; other formatting commands and drops are ignored.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = (e: Event) => {
      const type = (e as InputEvent).inputType ?? "";
      const toggle = FORMAT_INPUT_TYPES[type];
      const align = ALIGN_INPUT_TYPES[type];
      if (toggle) {
        e.preventDefault();
        callbacks.current.onToggleFormat(toggle);
      } else if (align) {
        e.preventDefault();
        callbacks.current.onAlign(align);
      } else if (type.startsWith("format") || type === "insertFromDrop") {
        e.preventDefault();
      }
    };
    el.addEventListener("beforeinput", block);
    return () => el.removeEventListener("beforeinput", block);
  }, []);

  const finish = (reason: EditExitReason) => {
    if (exited.current) return;
    exited.current = true;
    commit();
    callbacks.current.onExit(reason);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // In a list, Tab and Shift+Tab change the list level (Escape leaves the editor). Without a list Tab is left alone.
    if (e.key === "Tab" && object.list !== "none" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      changeLevel(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish("escape");
    }
  };

  // Paste as plain text only; pasted HTML would bring styles the model cannot hold yet.
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n");
    if (!text) return;
    if (typeof document.execCommand === "function" && document.execCommand("insertText", false, text)) return; // fires input
    if (ref.current && insertTextAtSelection(ref.current, text)) commit();
  };

  return (
    <div
      className="textedit"
      data-text-editor
      style={{
        left: object.x * zoom,
        top: object.y * zoom,
        width: object.width * zoom,
        height: object.height * zoom,
        transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
      }}
    >
      <div
        ref={ref}
        className={`slide__text slide__text--${object.role}${textClassNames(object)} textedit__inner`}
        style={{
          width: object.width,
          height: object.height,
          ...textStyle(object),
          transform: `scale(${zoom})`,
        }}
        dir={object.direction}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={`Editing ${object.name}`}
        spellCheck
        tabIndex={-1}
        onInput={commit}
        onCompositionEnd={commit}
        onBlur={() => finish("blur")}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onDrop={(e) => e.preventDefault()}
      />
    </div>
  );
}
