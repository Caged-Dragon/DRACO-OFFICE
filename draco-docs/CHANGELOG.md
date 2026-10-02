# Changelog

All notable changes to DocWrite are documented here, one entry per release.
Format: `## vX — Theme` followed by what shipped.

## v22 — Track Changes
No free or official TipTap extension exists for this (the real one is a
paid Tiptap Pro feature) — built from scratch using `appendTransaction`.

- Two new marks, `insertion` and `deletion`, each carrying `changeId`,
  `author`, `createdAt`. Typing while tracking is on wraps new text in
  `insertion`; deleting (Backspace/Delete/typing over a selection) does
  NOT remove the text — it re-inserts it immediately after, marked
  `deletion`, so it stays visible (strikethrough) until resolved
- A single replace action (select text, type a replacement) produces one
  `insertion` + one `deletion` sharing the SAME `changeId`, so Accept/Reject
  acts on the whole edit as one unit — not two unrelated changes
- Accept/Reject per change, plus Accept All / Reject All, each correctly
  inverse to the other (reject an insertion deletes the typed text; reject
  a deletion restores the original text)
- Changes panel: one entry per `changeId`, showing inserted/deleted text,
  author, and timestamp — fully derived by reading the document's own
  marks (`track-changes.ts`), no separate data array to keep in sync
- Theme-aware insertion (underline) / deletion (strikethrough) coloring,
  both themes checked by `check:contrast` before shipping
- **Deliberately scoped, not just "as far as I got":** the transaction
  rewrite only engages for a single transaction with exactly one
  `ReplaceStep`, confined to one block, with flat inline content on both
  sides. Structural edits (paragraph merges/splits, table edits,
  block-level paste, multi-step transactions like `setContent`) are left
  completely untouched — verified explicitly with a `splitBlock()` test
  that confirms no tracking AND no crash, rather than assuming either
- **Tested in a real headless editor against actual editing actions, not
  just the data model**: 29 checks covering tracking on/off, insertion
  marking, deletion-without-removal, the shared-changeId pairing, accept
  and reject for pure insertions, pure deletions, and paired replaces,
  Accept All/Reject All across independent changes, disabling tracking
  mid-session, the structural-edit safety boundary, and that all mark
  attributes survive a `getJSON`/`setContent` round-trip (the save/reload
  path)
- Caught by the build, not by guessing: a real type error (ProseMirror's
  `Node.marks` is `readonly Mark[]`, my `listChanges` type wasn't) —
  fixed immediately, not worked around
- **Scope decision, stated plainly:** the on/off toggle is a per-session
  setting, not persisted in `.dwdoc` — it resets to off each time the
  editor loads. The marks themselves DO persist (they're ordinary document
  content), so existing tracked changes remain visible and actionable
  after reopening a file; only "is tracking currently turned on" resets.
  Revisit this once v51+ brings real collaboration/accounts, where "who
  has tracking on" becomes a more meaningful document-level property
- **New dependencies: none** — uses `@tiptap/pm/transform`'s `ReplaceStep`,
  already present via the existing TipTap stack

## v21 — Comments
**First version of the v21–v30 block.**

- Inline comments: select text, "Add comment" writes a comment anchored to
  that range. A new `comment` Mark (`comment-extension.ts`) tags the text —
  a real persisted mark, not a decoration — so it survives save/reload
- Comments sidebar panel: list, reply threads, resolve/reopen, delete.
  Unresolved count shown on the toolbar's "Comments" toggle
- Theme-aware highlighting: commented text gets an amber-ish background in
  both light and dark page themes (new `--doc-comment-bg` /
  `--doc-comment-resolved-bg` tokens in `style-sets.ts`), resolved comments
  fade to a neutral background. Every combination checked by
  `npm run check:contrast` before being wired in — passed on the first try,
  194 checks green
- **Resolving a comment updates the mark itself**, not just the sidebar:
  `setCommentResolvedById` rewrites the `resolved` attribute on every mark
  instance for that comment id, so the highlight color actually changes and
  that change survives a save/reload (verified via `getJSON`/`setContent`
  round-trip in a real headless editor, not assumed)
- **Deleting or resolving one comment never touches another.** Comments can
  sit on adjacent or overlapping text; `removeCommentById` and
  `setCommentResolvedById` both walk the document and act only on marks
  matching the specific id. Verified in a real headless TipTap editor with
  three comments on adjacent words: removing the middle one left the other
  two, and the document's actual text, completely untouched
- `inclusive: false` on the mark — typing immediately after a commented
  word does not silently extend the comment onto new text. Verified
  explicitly, since the opposite (TipTap's default) would be the kind of
  subtle bug that's invisible until someone edits right next to a comment
- Comments extend the autosave draft and `.dwdoc` format (bumped to format
  version 3). Tested against the real `file-format.ts` and its real
  dependency chain: v1 files (pre-v14) and v2 files (pre-v21, with
  header/footer but no comments) both still load correctly, a v3 file with
  real comment data round-trips, and a corrupted `comments` field is
  sanitized to `[]` rather than crashing the whole file load
- Comment data model (`comments.ts`) is pure and framework-free — tested
  with 20+ cases including hostile input (wrong types, missing fields,
  non-array `replies`, prototype-pollution-shaped objects), all handled
  without throwing or leaking unexpected keys
- Applying a template (v18) now clears comments along with content, since
  the underlying marks are gone too — comments on text that no longer
  exists would be meaningless
- **New dependencies: none.** Comment IDs use `crypto.randomUUID()`, a
  built-in Web API, not a package
- **Known limitation, stated plainly:** comments have no concept of an
  author — there's no account system yet in this single-user phase, so
  every comment/reply is just a body and a timestamp

## v21.1 — Left Sidebar Layout
**UI rework, requested directly: move all formatting tools off the top of
the page into a vertical rail on the left**, so the document isn't pushed
down by 15 stacked toolbar rows.

- Replaced the 15 horizontal `ToolbarRow`s stacked at the top with a single
  vertical icon rail (`sidebar-rail.tsx`) on the left edge. One flyout panel
  open at a time, closed by default — so by default almost the entire
  viewport is the document, not chrome
- `toolbar-nav.ts` extended with an `orientation` parameter (horizontal was
  the only mode before) so the same tested arrow-key logic drives both the
  vertical rail (Up/Down) and each panel's horizontal control row
  (Left/Right) — not two parallel implementations. Re-tested including a
  regression check that existing horizontal callers are byte-for-byte
  unaffected by the new parameter
- `ToolbarRow` stripped of its hardcoded `border-b`/padding chrome — it's
  now a pure accessible-toolbar behavior wrapper, with the panel fully
  controlling layout, since it no longer lives in a fixed top row
- Every control component (FileControls, FontControls, TableControls, etc.)
  is unchanged — only the container around them moved. This was a
  deliberate scope decision to keep the risk of this refactor contained to
  layout, not reopen 15 already-tested features
- **Verification, not assumption, for a refactor of this size:**
  - Fresh `tsc` build and clean `eslint` after the change
  - `check:contrast` re-run clean (197 checks) with the new rail/panel UI
    in place
  - Wrote a real React-in-jsdom test for the new `SidebarRail` component:
    renders the right buttons, click opens/toggles-closed, and full
    keyboard navigation — Up/Down movement, wrapping at both ends, Home/End,
    and confirming Left/Right (the wrong axis) correctly do nothing
  - Caught and fixed a real accessibility bug during this work: the rail
    was originally a `<nav>` with `aria-orientation`, which ESLint's
    jsx-a11y plugin correctly flagged — `<nav>`'s implicit `role="navigation"`
    doesn't support that attribute. Changed to `role="toolbar"` on a
    plain `<div>`, consistent with how every other toolbar in this app is
    already marked up, rather than suppressing the lint warning
  - **Caught my own bug mid-task**: an index-based string splice computed
    `start`/`end` positions, then two unrelated `.replace()` calls shifted
    the string before those positions were used, corrupting the file into
    invalid JSX nested inside itself. Caught by the next build step (which
    failed), diagnosed via a direct file view rather than guessing,
    restored the known-good pre-refactor file, and redid the edit with the
    index-dependent splice performed first and the order-independent
    text-anchor edits done after, which is the actually-correct ordering
- **New dependencies: none**
- Tagged `v0.21.1` (patch), not a new `v0.22.0` feature version — this
  changes how existing v21 features are organized on screen, it doesn't add
  a new one

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
