# Text boxes and object editing (v0.11.0)

## What you can do
- **Insert > Text box** adds a free text box (role `textbox`) in the middle of the slide, selected. New boxes cascade by 24 px if one is already there. Names are "Text box 1", "Text box 2", ...
- **Select**: click an object on the canvas, or focus its field in the Text panel. Clicking empty canvas or pressing Escape clears the selection. The selection belongs to the slide and is cleared when another slide becomes current.
- **Move**: drag the selected (or any) object. **Resize**: drag one of the 8 handles; the opposite edge stays fixed. Handles keep a constant on-screen size at every zoom level.
- **Delete**: Delete or Backspace with the canvas focused, or Home > Delete object. There is no undo until Version 20.
- Edit the text in place (double-click or Enter, see `text-editing.md`) or in the Text panel. The status bar shows the selected object's position and size in slide pixels.

## Rules
- Objects are never changed by a plain click: a drag only starts after the pointer moves 3 screen pixels.
- Minimum size 20 x 20; at least 20 px of an object always stays on the slide, so it cannot be lost off the edge. Values are rounded to two decimals.
- Space+drag or the middle button still pans, even over an object.
- Title and body placeholders can be selected, moved, resized and deleted like any object.

## Document model
Schema 3 adds the `textbox` role (migration from 2 changes no data). See `docs/architecture/document-model.md`.

## Limits
Mouse only (keyboard nudging and resizing arrive in Version 17); no multi-select, snapping, rotation, or aspect-ratio lock yet; resize handles ignore rotation (nothing can be rotated yet); each mouse-move during a drag is one document change, which matters for undo grouping in Version 20.
