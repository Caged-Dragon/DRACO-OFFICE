# Undo and redo (v0.20.0)

## Using it
- **Undo** and **Redo** buttons in the editor's top bar (tooltips name the change, e.g. "Undo Move or resize (Ctrl+Z)"). Shortcuts: **Ctrl/Cmd+Z** undo, **Ctrl/Cmd+Y** or **Ctrl/Cmd+Shift+Z** redo, when focus is in the editor but not in a text field.
- Screen readers hear "Undid ..." / "Redid ..." after each use.
- Up to **100** steps are kept per open presentation. History is per editing session: it starts empty each time a presentation is opened and is not saved in the file.

## What is undoable
Every change to the document: adding, deleting, duplicating, renaming and reordering slides; inserting, moving, resizing, deleting objects; text; font, paragraph, list and text box formatting; grouping, ungrouping and locking; the presentation's title and properties.

Not recorded: selecting, switching slides, zooming and panning, text editing state, and settings (theme, rulers, snapping...).

## What one step covers
A continuous gesture is a single step:
- A whole **drag** (move or resize), however many mouse movements it takes. The step ends when the mouse button is released.
- A **run of nudges** while an arrow key is held; each separate tap is its own step.
- A whole **text editing session** (from entering the editor until you leave it) and typing in the title box.
- A stream of **color picker** changes on one object (until you change something else).
Everything else is one action, one step. Selecting or any other change between two gestures always separates them.

## Text editing and the browser's own undo
While you type in the text editor or any text field, **Ctrl+Z belongs to the browser** and undoes your typing as usual; it is not intercepted. When you leave the editor, the whole session is one step you can undo with the app's Undo. Using the Undo *button* while editing ends editing and undoes the session.

## What an undo restores
The document exactly as it was, plus the slide you were on and the objects you had selected. Text editing always ends. Redo works the same way in reverse; making any new change after an undo discards the redo steps.

## How it works
`state/history.ts` wraps the editor reducer. Before a document-changing action it pushes a snapshot of the previous state (the presentation is immutable, so snapshots share almost all of their data and cost little memory). Streaming actions share a "coalesce key" and merge until another action or an explicit `breakHistory` (sent when a drag ends or an arrow key is released).

## Limits
- History is lost when the presentation is closed or the page reloads.
- Consecutive color-picker changes on the same object with nothing else in between merge into one step even if you reopened the picker.
- The undo steps for typing are per session, not per word.
- Undo does not touch the file on disk by itself: the restored document is autosaved like any other change.
