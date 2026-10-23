# Editing text in place (v0.12.0)

## How to edit
- **Double-click** a text object (title, body or text box), or select it and press **Enter** or **F2**, or use **Home > Edit text**. The caret goes where you double-clicked, or to the end of the text.
- Type, select, copy, cut and paste as in any text field. **Escape** finishes editing (the object stays selected and the canvas gets focus). Clicking anywhere else on the canvas, another object, a ribbon button, or another slide also finishes it.
- Enter starts a new line; the status bar shows "– editing text" and screen readers hear "Editing <name>. Press Escape to finish."
- Pasting always inserts **plain text**. Browser formatting shortcuts (Ctrl+B and similar) and dropping content are blocked until formatting is supported.

## How it works (and why the caret stays put)
- Text objects still store plain text; a line break (`\n`) separates lines. Rendering uses one block per line, the same structure on the canvas, in thumbnails and in the editor, so text does not shift when editing starts.
- While you edit, the browser owns a `contenteditable` surface. It is built once and **never re-rendered by React**, so the caret, selection, IME composition and the browser's own undo are untouched. Each input event reads the surface back into plain text (`features/canvas/textDom.ts`, `domToText`) and updates the document, which autosaves, updates the thumbnail and the Text panel live.
- `domToText` understands what browsers produce: a div or paragraph per line, `<br>`, nested inline elements, stray top-level text, non-breaking and zero-width characters, and newlines inside text nodes.
- If the editor is removed without a blur (for example by a click handler), a final read keeps the last edit.
- Keys typed in the editor (Space, Delete, +, -, PageUp/PageDown, arrows) are not treated as canvas or slide shortcuts.

## Not in this version
- **Rich formatting** (bold, italic, underline, strikethrough, font family and size, colour) is Version 13. It needs runs with formatting marks in the document model (a schema change) and a way to apply them to a selection, so it is deliberately not faked here.
- Alignment, lists, margins and text fitting are Versions 14 to 16.
- No global undo until Version 20; inside one editing session the browser's own Ctrl+Z works, but it is cleared when editing ends.
- Rotated objects are edited unrotated-looking only in the sense that the editor follows the object's rotation transform; nothing can be rotated yet.
- Behaviour in real browsers (caret placement from a double-click, IME input, paste via `execCommand`) is only unit-tested against jsdom, which implements selection and ranges but not layout or editing commands.
