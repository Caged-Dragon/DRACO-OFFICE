# Changelog

## 0.12.0 (Roadmap Version 12, text editing surface)
- In-place text editing on the canvas: double-click, Enter, F2 or Home > Edit text; Escape or clicking elsewhere finishes. Works for titles, bodies and text boxes.
- The browser owns the editing surface while you type (built once, never re-rendered), so caret, selection, IME and native undo behave normally. Text is read back on every input (`domToText`) and flows into the document, thumbnails, Text panel and autosave.
- Plain-text paste; browser formatting commands and drops are blocked until formatting exists.
- Text is rendered as one block per line everywhere so text does not shift when editing starts.
- Keys typed in the editor no longer trigger canvas shortcuts or slide navigation.
- **Scope note:** formatting ("rich text": bold, italic, fonts, colours) is not in this version. It needs a document-model change and arrives with Version 13.
- Limits: behaviour in real browsers is untested; no global undo until Version 20.

## 0.11.0 (Roadmap Version 11)
- Text boxes: Insert > Text box; select, move, resize (8 handles) and delete objects directly on the canvas. Selection shown on the canvas, in the status bar and announced to screen readers; the Text panel and canvas selection stay in sync.
- New ribbon tab Insert; Home > Delete object; Delete/Backspace/Escape with the canvas focused.
- Interactions are measured in slide units (zoom-independent), start only after a 3 px movement, keep at least 20 px of an object on the slide, and never fight Space/middle-button panning.
- Document schema 3 (adds the `textbox` role) with automatic migration from schema 2; older apps will not open schema-3 files.
- Geometry module `core/geometry/rect.ts` (move, resize, constrain) with unit tests.
- Limits: mouse only (keyboard nudging in Version 17), no multi-select, snapping, rotation or in-place text editing yet; no undo until Version 20.

## 0.10.0 (Roadmap Version 10: end of Phase 1)
- Settings dialog: theme (match system, dark, light), default slide size, default author, default pane visibility. Persisted in localStorage with per-field repair and a visible warning if storage is blocked.
- Light theme; all colours now come from CSS variables. Both themes are checked against WCAG AA contrast by a test (`tests/unit/contrast.test.ts`, `utils/contrast.ts`).
- Error handling: error boundaries (editor recovery screen with reload / save-a-copy / close; app-level reload screen), global handlers for uncaught errors and unhandled rejections, central logger.
- Accessibility foundations: modal focus trap, polite announcements of slide changes, ribbon tab panels always present (valid `aria-controls`), axe-core tests on the main screens.
- Testing baseline: coverage script, Playwright config and e2e smoke tests, `npm run verify`, developer and testing docs.
- Limits: no coverage threshold yet; e2e covers Chromium only; manual screen-reader testing still to do (Version 95).

## 0.9.0 (Roadmap Version 9)
- Native file: File > Save a copy to file (`.draco-slides.json`) and Home > Open from file. Strict import validation with size and count limits, unknown-field stripping, newer-version detection, and automatic migration of older schemas. Imports never overwrite an existing presentation.
- Storage errors are classified (full, blocked, other) and explained in the status bar, with Retry and Download backup.
- Saves now count only after the IndexedDB transaction commits.
- Autosave flushes when the page is hidden or closed and when the editor closes; leaving the page with unsaved changes asks for confirmation; a failed save on close is reported.
- Requests persistent browser storage (best effort).
- Home reports unreadable stored records (kept, not deleted).
- Fix: the "Saved" indicator no longer appears while a newer edit is still waiting to save.
- Limits: two tabs editing the same presentation are not detected (last save wins); no sharing between browsers or the desktop app until cloud sync.

## 0.8.0 (Roadmap Version 8)
- Zoomable, pannable canvas viewport replacing the fixed-size preview. Fit to window (follows window resizing), zoom 10% to 400%, Zoom in/out/Fit/Actual size in the View tab, +/-/0 keys, Ctrl/Cmd+wheel zoom at the cursor.
- Pan with the wheel, arrow keys, Space+drag or middle-button drag; the slide cannot be panned out of view.
- Documented coordinate system (slide pixels vs screen pixels) with a pure, unit-tested geometry module (`core/geometry/viewport.ts`).
- Status bar shows the pointer position in slide coordinates and the zoom level.
- The editing canvas shows objects that extend past the slide edge; thumbnails still clip them.
- Layout: the text panel now sits below the canvas instead of scrolling with it.
- Limits: no touch gestures; zoom/pan not persisted; no rulers or grid yet (Version 18).

## 0.7.0 (Roadmap Version 7)
- Slide pane keyboard navigation: Up/Down/Home/End select slides; only the selected thumbnail is in the Tab order (roving tabindex).
- Selection stays synchronized everywhere: whichever control changes the selection (ribbon, status bar, PageUp/PageDown, delete, duplicate), the pane scrolls the selected thumbnail into view and, if keyboard focus is in the pane, focus follows.
- Thumbnails show the slide name, and thumbnails of unchanged slides are not re-rendered while another slide is edited (`SlideThumbnail` is memoized; not benchmarked).
- Limits: no multi-select, no resizable pane, no virtualization for very long decks (planned for Version 91).

## 0.6.0 (Roadmap Version 6)
- Duplicate slide (new ids, inserted after the original, selected).
- Rename slide via dialog (blank names refused, 100-character cap).
- Reorder slides: Move up/Move down buttons, drag and drop in the slide pane, Alt+Up/Alt+Down on a focused thumbnail. Selection follows the moved slide.
- Delete slide now asks for confirmation (no undo yet).
- New slides get the next unused "Slide N" name, so names no longer repeat after deletions.
- Dialogs share a `Modal` component and now return focus to the element that opened them (fixes the v0.5.0 limitation).
- Limits: no multi-select, slide copy/paste, undo/redo or sections yet.

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
