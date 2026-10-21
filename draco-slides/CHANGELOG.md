# Changelog

## 0.5.0 (Roadmap Version 5)
- Document model schema 2: presentation metadata (author, description, language, created-with), object base properties (name, rotation, visible), documented in `docs/architecture/document-model.md`.
- Slide-size presets (16:9, 4:3, 16:10) selectable when creating a presentation; sizes validated.
- Strict validation (`validatePresentation`) with unique-ID, number and structure checks.
- Automatic, non-destructive migration of schema-1 presentations saved by 0.1.0 to 0.4.0; invalid records are skipped, never deleted.
- File > Properties dialog to edit title, author and description; shows size, slide count, dates and creating version.
- Canvas honors object visibility and rotation.
- Limits: slide size cannot be changed after creation yet; hidden/rotated objects have no editing UI yet.

## 0.4.0 (Roadmap Version 4, plus tag-based installer)
- Editor layout: File menu (Back to home, Close presentation), ribbon with Home and View tabs, toggleable slide pane, central canvas, status bar (slide position, slide size, save status).
- Accessible menu and tab components (arrow keys, Escape, focus return, `aria-pressed` toggles). PageUp/PageDown move between slides.
- Install now downloads the installer attached to the latest `draco-slides/v*` GitHub release (Windows .exe, macOS .dmg, Linux AppImage), then falls back to the browser install prompt, then the release page. The desktop app shows Update when a newer tag exists.
- Electron desktop wrapper (`desktop/main.cjs`) and electron-builder config; `npm run dist:win|mac|linux`.
- Release workflow template in `ci/draco-slides-release.yml` (must be copied into the monorepo root `.github/workflows/`).
- Fix: `typecheck` script is now `tsc -b`.
- Only Home and View ribbon tabs exist; other tabs arrive with their features. Windows installer is unsigned.

## 0.3.0 (Roadmap Version 3, plus requested web/app distribution)
- Home: optional title when creating a presentation, search across recent presentations, clearer empty states.
- Top-right release badge showing the latest `draco-slides/v*` GitHub tag (configurable via `VITE_GITHUB_REPO`), "Update available" hint, and an Install button.
- PWA support: web manifest, icons, network-first service worker (production builds only).
- `vercel.json` for deploying the `draco-slides` folder as a static Vite site.
- Tests for tag parsing/ordering, release badge, and Home.
- Known limits: no native desktop installer yet; Install is browser-dependent.

## 0.2.0 (Roadmap Version 2)
- Application shell: skip link, top bar with brand, main navigation (Home / Editor) and cloud status, single `<main>` landmark.
- Application-level state (`AppProvider`, `appReducer`): current view, open presentation, notifications.
- Notifications: info messages auto-dismiss, errors stay until dismissed. Open failures now use them.
- The open presentation stays mounted when you go Home and return, so edits are not lost.
- Fix: edits made less than 400 ms before the editor unmounts are now flushed to storage (v0.1.0 could drop them).
- Home screen heading is now "Your presentations"; the Home button moved from the editor bar into the shell navigation.
- Tests added for the app reducer and shell navigation.

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
