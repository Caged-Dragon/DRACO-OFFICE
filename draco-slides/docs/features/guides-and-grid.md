# Alignment guides, snapping, rulers and grid (v0.18.0)

## Snapping while dragging
- **Snap to objects** (on by default): while you move or resize an object, its edges and center snap to the slide's edges and center and to the edges and centers of other objects when they come within **6 screen pixels** (so the reach is larger in slide pixels when zoomed out, and smaller when zoomed in). The nearest target wins.
- **Alignment guides**: pink lines mark every edge or center that lines up with the slide or another object, including alignments you reach without snapping. They exist only while the mouse button is down.
- **Snap to grid** (off by default): the object's top-left corner (when moving) or the edge being dragged (when resizing) snaps to gridlines. Object targets win over the grid when they are closer.
- **Alt** held during a drag turns snapping off for that drag. Resizing around the center (Ctrl/Cmd) or with locked proportions (Shift on a corner) is not snapped. Keyboard nudging and the Position fields are never snapped.
- A resize snap that would make the object smaller than 20 px is ignored.

## Rulers
View > **Rulers** shows a horizontal and a vertical ruler in slide pixels. Labels are placed so they stay at least 50 screen pixels apart as you zoom (steps of 1, 2, 5 times a power of ten), the slide area is shaded, and the selected object's extent is highlighted. Rulers are decorative for assistive technology; exact values are in the Position fields.

## Gridlines
View > **Gridlines** draws a grid over the slide. Grid size: 5, 10, 20 (default), 25, 40, 50 or 100 slide pixels. A grid that would be closer than 4 screen pixels is not drawn (zoom in to see it); snapping still works.

## Where the settings live
These are per-user editing aids, not part of the presentation, so they are stored with your other settings (Settings dialog or the View tab) and apply to every presentation. Invalid stored values fall back to the defaults field by field.

## Not included yet
Draggable guide lines, equal-spacing guides and distribute/align commands (Version 27), and snapping while dragging several objects (multi-select arrives in Version 19).
