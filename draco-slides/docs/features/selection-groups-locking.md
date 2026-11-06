# Multi-selection, grouping and locking (v0.19.0)

## Selecting several objects
- **Shift, Ctrl or Cmd + click** adds an object to the selection or removes it. **Drag on empty canvas** draws a selection rectangle and selects the objects it **completely encloses** (Shift+drag adds to the current selection). **Ctrl/Cmd+A** or **Home > Select all** selects everything on the slide. **Escape** or a click on empty canvas clears it.
- A bounding box with handles surrounds a multiple selection. The status bar reads "Selected: 3 objects (x, y, w x h)" or "group of 3 objects (...)", and screen readers hear "3 objects selected".
- **Single-object commands** (text editing, font and paragraph formatting, text box layout, the Position fields) work only when exactly one object is selected and are disabled otherwise. **Delete**, **Lock**, **Group**, nudging and resizing work on the whole selection.

## Moving and resizing a selection
- Dragging any selected object moves all of them together; arrows move by 10 px (Ctrl/Cmd: 1 px). Snapping and alignment guides treat the selection as one rectangle and snap to the objects that are **not** selected. Shift locks the movement to one axis.
- A handle scales the whole selection from its bounding box: positions and sizes scale together, font sizes do not. Shift+arrows resize by keyboard. The selection can never be made small enough to shrink any member below 20 px.
- The whole selection is kept on the slide as one: at least 20 px of its bounds stay visible.
- A plain click (no drag) on an already selected object in a larger selection narrows the selection to that object.

## Groups
- **Home > Group** (or Ctrl/Cmd+G) joins two or more selected objects into a group; **Ungroup** (Ctrl/Cmd+Shift+G) splits it. Clicking any member selects the whole group, and a group moves, resizes, deletes and locks as one.
- **Drill in:** click a member of a selected group again (without dragging) or double-click it to select that member alone ("in a group" in the status bar). It can then be edited, formatted, and moved on its own; it stays in the group.
- Groups are **one level deep** (no groups inside groups): grouping objects that are already in other groups moves them into the new group. A group always has at least two members, so a group reduced to one member (by deleting or regrouping) is dissolved automatically. Grouping makes the members adjacent in the stacking order, at the position of the topmost one.
- **Tab / Shift+Tab** treat a group as one stop.
- Duplicating a slide gives the copy its own, independent groups.

## Locking
- **Home > Lock** locks the selected objects (the button shows its pressed state when everything selected is locked; pressing it on a mixed selection locks everything). Locked objects cannot be **moved, resized or deleted** by mouse, keyboard, Position fields, fitting commands or Delete; they show no handles, a dashed outline and "– locked" in the status bar. Trying anyway explains why.
- **What stays possible:** selecting, copying, editing the text and changing any formatting. Locking is a safeguard against accidents, not a security feature, and anyone can unlock.
- A selection containing any locked object cannot be moved, resized or deleted as a whole.

## Document model
Schema 8 adds `groupId` (null or an id shared by the members) and `locked` to every object. Migration from schema 7 leaves everything ungrouped and unlocked.

## Limits
- No copy/paste of objects (so none for groups), no alignment or distribute commands (Version 27), no z-order commands yet, no nested groups, no group-level formatting.
- Snapping while resizing a multiple selection uses the bounding box only.
- Rubber-band selection needs a mouse; keyboard users select with Tab, Shift+Tab, Ctrl/Cmd+A and the Text panel.
- None of the pointer interactions have been tried in a real browser, only in jsdom.
