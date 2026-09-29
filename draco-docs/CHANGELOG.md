# Changelog

All notable changes to DocWrite are documented here, one entry per release.
Format: `## vX — Theme` followed by what shipped.

## v20 — Accessibility
**Last version of the v11–v20 block.**

- **Light / Dark / System page theme.** A per-user *preference*, not
  document data — deliberately stored separately from `.dwdoc`/page
  settings, so opening a colleague's file never changes how your editor
  looks, and your theme never travels inside a file you share. "System"
  tracks the OS setting live via `useSyncExternalStore` (matchMedia), not
  an effect+state pattern
- **Automated WCAG AA contrast enforcement**, added as a new repo script:
  `npm run check:contrast`. It loads the app's *real* color data (style
  sets, palettes) through the project's own TypeScript rather than
  duplicating numbers, computes real contrast ratios, and scans all
  `.tsx` source for known-low-contrast utility classes and unlabeled form
  controls. Run against the code as it stood before this version, it
  failed 19 times — confirming the checker actually catches real problems
  rather than trivially passing:
  - `text-slate-500`/`600` on the dark toolbar chrome (as low as 2.6:1
    against a 4.5:1 requirement)
  - the v4 font-color swatches on the white page (several under 3:1)
  - 10px status-bar text, hard to read regardless of color
  - the title input's placeholder (2.56:1 on white)
  - 3 `<input>` elements with no accessible name (2 in Find & Replace, 1 in
    the Link URL popover)
  All fixed, then the same checker re-run clean (166 checks passing)
- **Theme-aware color system**: text-color and highlight swatches replaced
  with named palettes (`color-palettes.ts`) — one set for light pages, one
  for dark — every entry AA-verified against its page background. Style
  sets (v19) now carry dark-mode heading/body colors alongside their
  light-mode ones. Table header background, borders, and header/footer
  text now follow the theme via CSS custom properties instead of
  hard-coded hex/Tailwind classes
- **Keyboard navigation**: toolbar rows are now `role="toolbar"` with
  arrow-key movement between controls (Home/End too), per the WAI-ARIA
  toolbar pattern — implemented as a pure, unit-tested function
  (`toolbar-nav.ts`) plus a thin wrapper component, rather than ad hoc
  per-row key handling. Text inputs and selects correctly keep their own
  arrow-key behavior (verified explicitly, since breaking that would make
  every text field harder to use, the opposite of the goal)
- **Skip-to-content link** at the top of the editor, jumping keyboard users
  straight past 15 toolbar rows to the document
- **Global `:focus-visible` restoration.** Several controls use
  `focus:outline-none` for their custom active/selected styling; a
  site-wide `!important` rule guarantees a visible focus ring survives
  regardless, so no future component can silently drop keyboard
  visibility the way a few already had
- **Hardening**: `sanitizePageSettings` extended to validate the new
  `styleSet`/theme-adjacent fields the same way v19 hardened the rest
- **New dependencies: none.** The checker script reuses `typescript`,
  already a devDependency since v1 — confirmed no `npm install` ran this
  version
- **Honest limitation, stated rather than implied away:** everything above
  is verified by math (real contrast ratios), static analysis (source
  scans), and logic tests (toolbar-nav). None of it is a substitute for
  testing with an actual screen reader or real keyboard-only navigation in
  a browser — that has not been done as of this version, and is called
  out explicitly in README's Known Limitations rather than left unsaid

## v19 — Styles
- **Document style sets**: Default, Classic, Modern, Formal, Minimal. Each is a
  named typography theme (heading/body font, heading/body color, line height)
  applied document-wide via CSS variables. System font stacks only — no web
  fonts, no external requests. Direct formatting (e.g. a font chosen via the
  v4 toolbar) still overrides the style set, as expected
- The selected style set is saved with the document's page settings, so it
  round-trips through `.dwdoc` files and localStorage. No file-format
  version bump needed: the new field is additive and defaults safely
- Block styles: Quote and Code block toggles
- **Clear formatting**: removes bold/italic/underline/strike/highlight,
  color, font family/size, line height, and alignment; resets headings/lists
  to plain paragraphs and resets indent. **Links are deliberately kept**
- **Hardening**: page settings from localStorage or a `.dwdoc` file now pass
  through one `sanitizePageSettings()` that validates *every* field (size,
  orientation, margin, style set) against its allowed values. Previously a
  hand-edited file with e.g. `size: "Foo"` would crash the layout code —
  a gap that had existed since v10. Tested with corrupt, hostile, and
  prototype-pollution-shaped input
- **Bug fix (affected v13–v18): duplicate `Link` extension.** StarterKit
  bundles Link in this TipTap version; v13 registered it a second time.
  That logged a "duplicate extension" warning and made it ambiguous which
  config won — meaning v13's `openOnClick: false` (edit-in-place,
  Ctrl/Cmd+click to open) may not have applied. Link is now configured
  through `StarterKit.configure({ link: ... })`. Verified in a headless
  editor built from the app's real extension list: zero duplicates, and
  `openOnClick === false` / `autolink === true` confirmed. This is the same
  class of bug as the `Underline` duplicate fixed in v8; this time the
  whole extension list was cross-checked against StarterKit's bundle
- **Dependencies: net −1.** Removed the now-redundant direct
  `@tiptap/extension-link` dependency (still present transitively via
  StarterKit). Nothing added. Testing used jsdom installed in a throwaway
  directory outside the project; it is not in `package.json`
- Testing: style-set resolution and sanitizer logic verified with unit-style
  checks; the clear-formatting chain verified end to end in a real headless
  TipTap editor with the real extensions on richly-formatted content

## v18 — Templates
- Template picker in the editor toolbar: Blank, Resume, Cover Letter,
  Business Letter, and Report starters
- Templates are authored directly as TipTap JSON in `templates.ts` — no
  external files, no network fetch, consistent with the isolation policy
- Choosing a template replaces the current content and sets the title;
  if the document already has content, a confirmation prompt appears first
  so nothing is overwritten silently
- Header, footer, page settings are left untouched when applying a template
- Validated every template's JSON against a ProseMirror schema (`doc.check()`)
  before wiring it in, since a malformed node would only fail at runtime,
  not at type-check time. All 5 valid, IDs unique
- Scope note: templates apply from inside the editor. Starting from a
  template directly off the dashboard would need query-param routing plus a
  Suspense boundary for a statically prerendered route — deliberately
  deferred rather than adding that complexity here
- **New dependencies added: none**

## v17 — Word Stats
- Word count, character count, and reading time, shown live in the status bar
- Selection now also shows its own word count (not just character count),
  matching Word/Docs convention
- Reading time computed at 200 words/minute, rounded up, with a 1-minute
  floor for any non-empty document
- Pure, dependency-free calculation (`text-stats.ts`) — behaviorally tested
  for edge cases before wiring it in: empty doc, whitespace-only doc,
  multiple/leading/trailing spaces not inflating word count, paragraph
  breaks counted as word separators, and reading-time rounding at exact
  boundaries (200 words = 1 min, 201 words = 2 min)
- **New dependencies added: none** — no `npm install` run this version,
  consistent with the isolation policy from v16

## v16 — Spell Check
- **New project policy, effective this version onward:** isolated, self-contained
  implementations preferred over external npm packages or external services —
  see the new "Security & Dependency Policy" section in README.md
- Dictionary-based spell checking, fully self-built: no npm package installed,
  no external spell-check API, no data leaves the browser
- Bundled dictionary (`app/editor/dictionary.ts`): ~5,000 words, self-authored
  from a base word list plus generated inflections — not fetched from any
  external source or system dictionary
- Squiggly-underline decorations (custom CSS gradient, no external asset) for
  words not found in the dictionary or the user's local custom dictionary
- "Add to dictionary" per flagged word, persisted to `localStorage`
- On/off toggle, and a panel listing all currently flagged words with
  edit-distance-based suggestions
- **New dependencies added: none.** Confirmed via `npm ls` that `package.json`
  was untouched this version
- Found real gaps via behavioral testing, not just type-checking: the first
  version of the bundled dictionary flagged ordinary words ("fox", "fine",
  "test") and failed on contractions ("it's") as false positives. Fixed by
  expanding the word list and re-running the same test suite until it
  actually passed — documented as an explicit known limitation rather than
  claimed as complete coverage

## v15 — Find & Replace
- Custom extension (no maintained official/community one exists for this
  TipTap version): ProseMirror decorations highlight all matches, with the
  current match distinguished visually
- Search input with live match count (`N / total`), next/previous navigation
  (also via Enter / Shift+Enter)
- Replace current match, or replace all
- Known limitation, documented rather than hidden: matching is per text
  node, so a match split across a formatting-mark boundary (e.g. searching
  "hello" where only "hel" is bold) won't be found
- Verified the match-finding and replace-ordering logic against a real
  ProseMirror document and Transaction (not just type-checked): correct
  positions for multi-paragraph case-insensitive matches, correct
  replace-all behavior when replacing back-to-front so earlier match
  positions don't shift, and correct single-match replace leaving other
  matches untouched
- README.md rewritten to a professional/industry-standard structure
  (badges, features checklist, tech stack, project structure, roadmap,
  known limitations) — the template for all versions going forward

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
