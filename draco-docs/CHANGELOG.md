# Changelog

All notable changes to DocWrite are documented here, one entry per release.
Format: `## vX — Theme` followed by what shipped.

## v14 — Headers/Footers
- Editable header and footer text fields, rendered at the top/bottom of the
  page (only taking up space when non-empty)
- "Show page number" toggle
- Honest limitation, not silently hidden: page numbering currently shows a
  static "Page 1", since there's no real multi-page pagination yet — the
  editor is still one continuous scrollable page visually. Real page-by-page
  numbering depends on the pagination work that print (v29) will need anyway
- Extended the persisted schema (autosave draft + `.dwdoc` file format) to
  `{title, header, footer, showPageNumber, content, pageSettings}`, bumped
  file format to version 2, and verified — behaviorally, not just via
  types — that older v1-format files and pre-v14 drafts still load correctly
  with header/footer/showPageNumber defaulting sensibly

## v13 — Links
- Auto-linking: typed/pasted URLs become links automatically (TipTap's Link
  extension, `autolink: true` — no extra code needed)
- Manual link button with an inline URL popover to add/edit a link, and a
  separate remove-link button
- URLs without a protocol are normalized to `https://`
- `openOnClick` disabled so a plain click edits the link instead of
  navigating away; Ctrl/Cmd+click opens it in a new tab instead (added via
  a custom `handleClick`, matching the Word/Docs convention)
- Caught and fixed a lint error during development: the URL popover
  originally pre-filled itself via a `useEffect` watching `open`, which
  triggers a synchronous `setState`-in-effect violation. Moved the pre-fill
  into the toggle button's own `onClick` instead

## v12 — Images
- Insert image from a local file (converted to a base64 data URL client-side —
  no upload backend exists yet, consistent with the offline-first, local-storage
  scope for v1–50)
- Resize via drag handles, using TipTap's built-in `resize` option on the
  Image extension (no custom NodeView needed)
- Text wrap: a custom `wrap` attribute (none/left/right) extending the base
  Image node, rendered as float/margin CSS — TipTap has no built-in concept
  of text-wrap for images
- Known limitation to revisit later: base64-embedded images inflate `.dwdoc`
  file size by roughly a third versus the original file. Fine for now; would
  want real asset storage before this app handles image-heavy documents

## v11 — Tables
- Insert table (3×3 with header row by default)
- Add/delete rows and columns, from a context-sensitive toolbar row that
  only appears while the cursor is inside a table
- Merge/split cells, toggle header row
- Column resizing (drag handles), via TipTap's `resizable: true` table option
- Added dedicated CSS for table borders, the resize handle, and selected-cell
  highlighting — Tailwind Typography's default table styles don't cover
  editable/resizable tables

## v10 — Local Save/Load
- Native file format: `.dwdoc` (JSON: title, TipTap content, page settings, format version)
- "Save to disk" and "Open…" buttons, using the File System Access API where
  supported (Chrome/Edge) with a download/`<input type="file">` fallback for
  browsers that lack it (Firefox, Safari)
- Opening a file replaces the current document's title, content, and page
  settings, and immediately re-syncs the autosaved draft to match
- Added ambient TypeScript types for the File System Access API subset used
  (`showSaveFilePicker`/`showOpenFilePicker` aren't in the default DOM lib yet)
- Verified the serialize/parse round-trip behaviorally (round-trip, missing
  fields falling back to defaults, invalid files rejected), not just via
  the type-checker

## v9 — Page Layout
- Page size selector: Letter, A4, Legal
- Orientation: portrait / landscape (swaps the page's width/height)
- Margin presets: Narrow, Normal, Moderate, Wide
- Settings persist to `localStorage`, separate from the document draft
- Visual rework: the editor now renders as an actual white "page" on a dark
  canvas, sized in real inches and centered — like Word/Docs page view —
  instead of a borderless dark panel. Margin presets are applied as the
  page's padding, so this is also the first version where the editor
  visually shows margins, not just a config value with no visible effect

## v8 — Document Structure
- Heading dropdown: Paragraph, H1–H6 (StarterKit's Heading already supports
  all 6 levels by default, no config needed)
- Title page: a document title field above the body, persisted alongside
  content in the same autosaved draft
- Cleanup: removed a duplicate `Underline` registration — StarterKit bundles
  it by default in this TipTap version, so the separate package/import from
  v3 was redundant
- Reworked autosave (`use-autosave.ts`) to fix 4 lint errors surfaced by the
  stricter React Compiler hook rules: no ref writes during render, no
  synchronous `setState` inside effect bodies. Draft loading now happens via
  a lazy `useState` initializer instead of a mount effect, and title saves
  are triggered directly from the input's `onChange` instead of a
  title-watching effect

## v7 — History
- Undo/redo toolbar buttons (disabled state reflects `editor.can()`), plus
  the standard Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z shortcuts from StarterKit's
  bundled UndoRedo extension
- Autosave: document content is debounced (800ms) and saved to
  `localStorage` as JSON on every edit
- Draft restore: on load, any saved draft is restored into the editor
- "Saving… / Saved" indicator in the status bar
- SSR-safe: localStorage access is guarded so the server render doesn't crash

## v6 — Lists
- Bullet list and numbered list toggle buttons
- Nested lists via Tab (nest) / Shift+Tab (un-nest), using StarterKit's
  built-in list-item keymap
- Verified the Tab precedence concern flagged in v5: ListItem's Tab handler
  returns false outside a list, so it correctly falls through to the v5
  Indent extension for regular paragraphs — no conflict, nothing to fix

## v5 — Paragraph Formatting
- Text alignment: left, center, right, justify
- Line spacing selector (1, 1.15, 1.5, 2) via TipTap's bundled LineHeight extension
- Indentation: custom extension (no stable official one exists yet), with
  increase/decrease buttons and Tab/Shift+Tab shortcuts
- Note: Tab-to-indent may need a precedence check later once list items
  (which also use Tab, for sinking) land in v6

## v4 — Font Controls
- Font family selector (Default, Serif, Sans, Mono)
- Font size selector (Small, Normal, Large, Huge)
- Text color swatches (7 preset colors)
- Highlight color swatches with a "none" option to clear
- Corrected TipTap 3 extension imports (TextStyle/FontFamily/FontSize/Color
  ship bundled in `@tiptap/extension-text-style`, not as separate packages)

## v3 — Text Basics
- Formatting toolbar: bold, italic, underline, strikethrough
- Buttons highlight active state based on cursor/selection
- Standard keyboard shortcuts (Ctrl/Cmd+B, I, U) work via TipTap's built-in bindings

## v2 — Editor Core
- Rich-text editing engine (TipTap/ProseMirror) wired into the `/editor` route
- Live cursor position and selection-length tracking
- Placeholder text on empty document
- Tailwind Typography plugin added for prose-based content styling

## v1 — Project Foundation
- Next.js (App Router) + TypeScript + Tailwind project scaffold
- Installable PWA: web manifest, app icons, offline-capable service worker
- Base routing: home (document dashboard), editor (placeholder), settings (placeholder)
- Dark-themed base layout, mobile-safe-area aware viewport config
