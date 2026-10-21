# Changelog

## 0.1.0 (Roadmap Version 1)
- Vite + React + TypeScript project foundation.
- Home screen: new presentation, recent presentations (local), delete.
- Editor: slide list with thumbnails, 16:9 canvas preview, add/delete/select slides, edit title and body text, rename presentation.
- Document model v1 (presentation, slide, text object) with schema version and load-time validation.
- Local persistence in IndexedDB with debounced autosave and visible save status.
- Optional Supabase client (inactive unless env vars are set). No backend schema changes in this release.
- Unit and component tests (Vitest).

### Not yet implemented
Rich text, shapes, images, tables, charts, undo/redo, import/export, presenting, cloud sync, accounts.
