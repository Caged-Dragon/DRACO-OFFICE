# Canvas: coordinates, zoom and pan (v0.8.0)

## Coordinate systems
- **Slide coordinates** are slide pixels with the origin at the slide's top-left (x right, y down). All object geometry is stored in slide coordinates, so zooming never changes the document.
- **Screen coordinates** are CSS pixels relative to the canvas viewport element.
- `screen = pan + slide * zoom`, `slide = (screen - pan) / zoom` (`src/core/geometry/viewport.ts`, unit tested). `pan` is where the slide's top-left corner appears.

## Viewport behaviour
- Starts in **fit to window** (slide plus 32px padding, centered) and keeps fitting while the window is resized. Any manual zoom or pan switches to a manual view; **Fit to window** returns.
- Zoom range 10% to 400%. Buttons and the +/- keys step through presets (10, 25, 33, 50, 67, 75, 100, 125, 150, 200, 300, 400%); Ctrl/Cmd+wheel (and trackpad pinch) zooms smoothly around the cursor.
- Pan: mouse wheel, arrow keys (Shift = 5x), Space + left drag, or middle-button drag. A plain left drag is left free for selecting objects in later versions.
- The slide can never be lost: panning stops while at least 48px of the slide remains visible.
- Zoom and pan are kept when switching slides.
- The editing canvas shows objects that extend beyond the slide edge; thumbnails (and later, presenting and export) clip them.
- The status bar shows the zoom and the pointer position in slide coordinates.

## Keyboard (canvas focused)
`+` / `-` zoom, `0` fit, arrows pan, `Space` + drag pan.

## Limits
Touch gestures (pinch, two-finger pan) are not implemented; mouse and keyboard only. Zoom/pan are not remembered between sessions.
