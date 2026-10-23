import { useEffect, useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import type { TextObject } from "../../core/document-model/types";
import type { Point } from "../../core/geometry/viewport";
import { domToText, insertTextAtSelection, placeCaret, textToDom } from "./textDom";

export type EditExitReason = "escape" | "blur" | "click";

interface Props {
  object: TextObject;
  zoom: number;
  /** Where the user double-clicked (client coordinates); the caret goes there, otherwise to the end. */
  caretPoint: Point | null;
  onTextChange: (text: string) => void;
  onExit: (reason: EditExitReason) => void;
}

/**
 * In-place editor for one text object.
 *
 * The editing surface is a contenteditable whose DOM is built once and then left entirely to the browser, so
 * the caret, selection, IME composition and native undo behave exactly as users expect. React never re-renders
 * its children. Each input event reads the DOM back into plain text and reports it to the document.
 */
export function TextEditor({ object, zoom, caretPoint, onTextChange, onExit }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastText = useRef(object.text);
  const exited = useRef(false);
  const callbacks = useRef({ onTextChange, onExit });
  callbacks.current = { onTextChange, onExit };

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const text = domToText(el);
    if (text !== lastText.current) {
      lastText.current = text;
      callbacks.current.onTextChange(text);
    }
  };

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

  // Rich formatting is not supported yet: stop the browser from inserting its own <b>, <i>, styled spans...
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = (e: Event) => {
      const type = (e as InputEvent).inputType ?? "";
      if (type.startsWith("format") || type === "insertFromDrop") e.preventDefault();
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
        className={`slide__text slide__text--${object.role} textedit__inner`}
        style={{
          width: object.width,
          height: object.height,
          fontSize: object.fontSize,
          transform: `scale(${zoom})`,
        }}
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
