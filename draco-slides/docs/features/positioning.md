# Selecting, positioning and resizing (v0.17.0; multi-selection in v0.19.0, see selection-groups-locking.md)

## Keyboard (canvas focused)
| Keys | With an object selected | Nothing selected |
|---|---|---|
| Arrow keys | move 10 px | pan the view (Shift: 5x) |
| Ctrl/Cmd + arrows | move 1 px | |
| Shift + arrows | resize by 10 px from the top-left corner (Right/Down grow, Left/Up shrink) | pan 5x |
| Ctrl/Cmd + Shift + arrows | resize by 1 px | |
| Tab / Shift+Tab | select the next / previous object (back to front) | select the first / do nothing |
| Enter, F2 | edit the text | |
| Delete, Backspace | delete the object | |
| Escape | clear the selection | |

- Tab never traps keyboard users: past the last object (or before the first) the selection is cleared and focus moves on as usual.
- With an object selected the arrows move the object, so to pan use the mouse wheel, Space+drag, the middle button, or press Escape first.
- Everything stays inside the slide: at least 20 px of an object must remain visible, and objects are at least 20 x 20.

## Mouse modifiers while dragging
- **Shift** while moving: slide along one axis only (the larger movement). Shift on a **corner handle**: keep the proportions.
- **Ctrl or Cmd** on a handle: resize around the center instead of from the opposite edge.
- Modifiers can be pressed or released during the drag; each handle also has a larger invisible hit area to make small handles easier to grab.

## Exact values
Home > Position: **X, Y, Width, Height** in slide pixels (two decimals), for any selected object. Entries are clamped to what the slide allows, the field shows the clamped value, and text that is not a number restores the old one. The fields follow nudges and drags live.

## Limits
- Resizing is unrotated (nothing can be rotated until Version 24); no snapping, guides or grid yet (Version 18); no aspect-ratio lock toggle yet (Version 24).
- The first real try-out in a browser is still outstanding: modifier keys on mouse events and Tab handling are only tested in jsdom.
