# Shapes (v0.21.0)

## Inserting
**Insert > Shapes**: **Rectangle**, **Rounded rectangle**, **Oval** and **Line**. The shape is placed in the middle of the slide (cascading by 24 px if something is already there), selected, and named "Rectangle 1", "Oval 2", and so on. Drag it, resize it with the handles, nudge it with the arrow keys or type exact values in the Position fields, like any other object. Inserting is one undo step ("Insert shape").

Drawing a shape by dragging on the canvas is **not** built yet; it arrives with the pen tools (Version 0.25.0), and the shape style controls (fill, outline, opacity) with Version 0.23.0. New shapes use a blue fill (`#4472c4`) and a darker blue outline (`#2f528f`); lines are an outline only.

## How shapes work
- As in PowerPoint, every object is a **shape that can hold text**: a text box is a rectangle with no fill and no outline, and a drawn rectangle, rounded rectangle or oval can have text typed into it (double-click or Enter, white and centered by default). The Text panel lists shapes by name. The shape stays visible while its text is edited.
- A **rounded rectangle**'s corners are a sixth of its shorter side. An **oval** fills its box.
- A **line** runs corner to corner of its box (top-left to bottom-right; the model also supports the other diagonal, `flipV`, which gets its control in Version 0.24.0). It carries no text, has no text commands and is skipped by the Text panel. Its box may be flat: a horizontal line has a height of 0 and a vertical one a width of 0. A line can't be made shorter than 10 px, so it can never vanish. Flat lines get a 12 px click area.
- Everything else works the same on shapes: multi-select, group, lock, snapping and guides, undo, autosave, files.

## Size rules
Rectangles, rounded rectangles and ovals are at least 20 x 20 px, and 20 px of them must stay on the slide. Lines may be flat on one axis; a line that is thinner than 20 px along an axis only has to stay inside the slide along that axis.

## Document model
Schema 9. Each object now has `shape` (`rectangle`, `roundRect`, `ellipse`, `line`), `fill` and `stroke` (`#rrggbb` or null), `strokeWidth` (0 to 100) and `flipV`, and a new role `shape`. Migration from schema 8 turns every existing object into a plain rectangle with no fill and no outline, so nothing changes visually.

## Limits
- No drawing by dragging, no fill/outline/opacity controls, no rotation, flipping or aspect-ratio lock yet (V0.23.0 to V0.25.0); other shapes (arrows, stars, polygons, callouts, connectors) come in V0.22.0 and V0.26.0.
- Shapes are only checked in jsdom, never rendered in a real browser.
