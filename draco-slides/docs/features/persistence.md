# Saving, loading and files (v0.9.0)

## Local persistence
- Presentations are stored in the browser's IndexedDB (database `draco-slides`). The installed desktop app has its own separate store.
- Autosave runs 400 ms after the last edit. It also runs immediately when the page is hidden or closed (`pagehide` / `visibilitychange`) and when the editor closes with edits pending.
- The page asks the browser to keep the data persistently (`navigator.storage.persist`, best effort; browsers may refuse).
- A write only counts as saved once the IndexedDB transaction has committed.
- If saving fails the status bar says why (storage full, storage blocked, other) and offers **Retry** and **Download backup**. Leaving the page while changes are unsaved shows the browser's confirmation prompt.
- Stored records that cannot be read (invalid, or from a newer version) are never deleted. Home reports how many were skipped.

## Native file (preliminary)
- **File > Save a copy to file** downloads `<title>.draco-slides.json`. **Open from file** on Home reads it back.
- Format: a JSON envelope `{ format: "draco-slides", formatVersion: 1, savedWith, savedAt, presentation }` around the schema-2 presentation. The final native format is planned for Version 63; files written now will remain readable.
- Opening a file never overwrites an existing presentation: if the id is already stored, it is added as a separate copy titled "... (imported)".
- Import checks: 20 MB maximum, valid JSON, our format marker, not from a newer version, full structural validation (see `docs/architecture/document-model.md`), at most 2000 slides and 2000 objects per slide. Only known fields are kept; unknown data in a file is discarded.
- Older schemas inside a file are upgraded automatically.

## Limits
Presentations are not shared between browsers or between the website and the desktop app until cloud sync (Versions 81 to 85); use Save a copy / Open from file to move one. Concurrent editing of the same presentation in two tabs is not detected yet (last save wins).
