# DocWrite

**A cross-platform, offline-first document editor** — a from-scratch, incrementally built alternative to Microsoft Word and Google Docs, developed and released in 100 versioned stages.

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Version](https://img.shields.io/badge/version-v0.22.0-blue)
![License](https://img.shields.io/badge/license-unset-lightgrey)

---

## Table of Contents

- [Overview](#overview)
- [UI Overview](#ui-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Release & Versioning](#release--versioning)
- [Roadmap](#roadmap)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

DocWrite is a single-codebase document editor that runs as a website, an installable Progressive Web App, and (in later versions) a packaged native app for Android, iOS, Windows, and macOS.

It is built in **100 incremental versions**, each released as a tagged GitHub Release with the full source attached as a downloadable zip. Versions 1–50 deliver a complete, offline-first, single-user editor with `.docx` import/export. Versions 51–100 are scoped separately (collaboration, cloud sync, and beyond).

See [`CHANGELOG.md`](./CHANGELOG.md) for the detailed, version-by-version history.

## UI Overview

Formatting tools live in a **vertical icon rail on the left edge** of the
editor (File, History, Format, Links, Font, Paragraph, Headings, Style,
Lists, Table, Image, Page, Header/Footer, Comments, Accessibility) — closed
by default so the document itself has the screen, not a stack of toolbars.
Clicking an icon opens a single flyout panel with that group's controls;
clicking it again (or the panel's ✕) closes it. Only one panel is open at a
time. Keyboard users can move between rail icons with Up/Down/Home/End, same
WAI-ARIA toolbar pattern as before, just vertical now.

## Features

Current as of **v0.22.0**. Checked items are shipped; the rest are on the [Roadmap](#roadmap).

- [x] Rich-text editing core (TipTap / ProseMirror)
- [x] Text formatting — bold, italic, underline, strikethrough
- [x] Font family, size, color, and highlight
- [x] Paragraph formatting — alignment, line spacing, indentation
- [x] Bullet, numbered, and nested lists
- [x] Undo/redo and autosave (local, with draft restore)
- [x] Headings (H1–H6) and a document title field
- [x] Page layout — size (Letter/A4/Legal), orientation, margins
- [x] Local save/load as native `.dwdoc` files
- [x] Tables — insert, resize, merge/split cells
- [x] Images — insert, resize, text wrap
- [x] Hyperlinks — auto-linking and manual add/edit/remove
- [x] Headers, footers, and a page-number placeholder
- [x] Find & Replace
- [x] Spell check (dictionary-based, fully local — no external service)
- [x] Word/character count and reading time
- [x] Document templates — resume, cover letter, business letter, report
- [x] Document style sets (Default, Classic, Modern, Formal, Minimal), quote/code blocks, clear formatting
- [x] Accessibility — WCAG AA color contrast (automated check), keyboard navigation, screen-reader labels, light/dark/system page theme
- [x] Comments — inline, reply threads, resolve/reopen, theme-aware highlighting
- [x] Track changes — insertion/deletion markup, accept/reject (single or all), scoped to inline edits
- [ ] Footnotes, table of contents, and more — see Roadmap

## Tech Stack

| Layer            | Technology                                      |
|-------------------|--------------------------------------------------|
| Framework         | Next.js (App Router), TypeScript                 |
| Editor engine     | TipTap 3 (ProseMirror)                           |
| Styling           | Tailwind CSS + Tailwind Typography               |
| PWA               | Web app manifest + custom service worker         |
| Mobile packaging  | Capacitor *(planned)*                            |
| Desktop packaging | Tauri *(planned)*                                |
| CI/CD             | GitHub Actions (`.github/workflows/release.yml`) |
| Accessibility CI  | `npm run check:contrast` — WCAG AA audit, no external service |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
git clone <your-repo-url>
cd docwrite-app
npm install
```

### Development

```bash
npm run dev
# → http://localhost:3000
```

### Production build

```bash
npm run build
npm start
```

### Linting

```bash
npx eslint app/editor
```

### Accessibility check

```bash
npm run check:contrast
```

Verifies WCAG AA contrast for every document theme (light/dark) × style set ×
color palette combination, plus scans the source for known-low-contrast
utility classes and form controls with no accessible name. Run this after
touching any color or adding any `<input>`/`<select>`/`<textarea>`.

## Project Structure

```
docwrite-app/
├── app/
│   ├── page.tsx              # Document dashboard
│   ├── editor/
│   │   ├── page.tsx           # Editor route
│   │   ├── document-editor.tsx  # Main editor component — wires all extensions/toolbars
│   │   ├── *-controls.tsx      # One toolbar module per feature area
│   │   ├── *-extension.ts      # Custom TipTap extensions (indent, image-wrap, find/replace, …)
│   │   ├── file-format.ts      # Native .dwdoc serialize/parse
│   │   ├── local-file-io.ts    # File System Access API + fallback
│   │   ├── use-autosave.ts     # Debounced localStorage autosave
│   │   └── page-settings.ts    # Page size/margin/orientation
│   └── settings/page.tsx      # Settings placeholder
├── public/                   # PWA manifest, icons, service worker
├── .github/workflows/        # Release automation
├── CHANGELOG.md               # Version-by-version history
└── README.md
```

## Release & Versioning

Each version is a themed bundle of a few features, tagged and released via GitHub Actions.

**Tag scheme:** `v0.01.0` → `v0.99.0` = versions 1–99, `v1.00.0` = version 100 (version number = `major × 100 + minor`).

To ship a version:

```bash
git add .
git commit -m "vX.YZ.0 — <Version theme>"
git tag vX.YZ.0
git push
git push --tags
```

Pushing the tag triggers `.github/workflows/release.yml`, which builds the app, packages the source (and a production build) as zips, and publishes a GitHub Release with the matching `CHANGELOG.md` section as release notes.

## Roadmap

| Range     | Scope                                                              |
|-----------|---------------------------------------------------------------------|
| v1–v10    | Foundation, editor core, formatting, history, layout, local save/load — ✅ done |
| v11–v20   | Tables, images, links, headers/footers, find & replace, spell check, templates, styles, accessibility — ✅ done |
| v21–v30   | Comments, track changes, footnotes, TOC, references, print, PDF export — 🚧 in progress (v22/v30) |
| v31–v50   | `.docx`/`.rtf`/`.odt` import-export, drawing, equations, charts, accessibility, performance polish |
| v51–v100  | Real-time collaboration, cloud sync, and beyond — scoped separately |

## Known Limitations

Tracked honestly as they're found, not hidden. Full detail in `CHANGELOG.md`; summary:

- **Images** are embedded as base64, inflating `.dwdoc` file size ~33% versus the source file. No asset storage backend yet.
- **Find & Replace** only matches text within a single formatting run — a match split across a bold/italic boundary won't be found.
- **Page numbering** is a static placeholder ("Page 1") until real multi-page pagination lands alongside print support.
- **Spell check** uses a compact (~5,000-word) bundled dictionary, not a full system dictionary — uncommon or technical words will be flagged. "Add to dictionary" exists specifically to close real gaps as they come up.
- **Accessibility verification is automated, not manual.** `check:contrast` proves color math and scans for known anti-patterns; it does not replace testing with an actual screen reader or real keyboard-only use. No manual screen-reader pass has been done as of v20.
- **Comments are per-document, not per-user.** There is no concept of "who" wrote a comment or reply — no accounts exist yet in this offline-first, single-user phase. Every comment/reply just has a body and a timestamp.
- **Track changes only covers plain inline edits within one block** — normal typing, Backspace/Delete, and typing over a selection. Structural edits (paragraph merges/splits, table edits, block-level paste) are intentionally NOT tracked; they pass through as ordinary untracked edits rather than risking an incorrect rewrite. The on/off toggle is a per-session setting (resets to off on reload) — existing tracked marks in a document still persist and remain actionable.

## Security & Dependency Policy

**Effective from v0.16.0 onward:** new features are built as self-contained, isolated code within this repo wherever practical, rather than by adding external npm packages or calling external services.

- No new runtime dependency on a third-party npm package unless the capability genuinely cannot be built in-house within reasonable scope (the project still depends on its original core stack — Next.js, TipTap/ProseMirror, Tailwind — established in earlier versions).
- No document content, keystrokes, or user data is ever sent to an external API. Spell check, for example, runs against a dictionary bundled directly in this repo rather than a cloud spell-check service.
- No runtime fetches from external CDNs or third-party endpoints for core functionality.
- Each version's `CHANGELOG.md` entry notes explicitly whether any new dependency was added and why.

This is a security and supply-chain posture as much as a technical one: fewer external dependencies means a smaller attack surface and no silent data leaving the user's browser.

## Contributing

This project is currently developed as a solo, versioned build-in-public effort. Issues and suggestions are welcome via the repository's issue tracker.

## License

**Not yet chosen.** Add a `LICENSE` file before any public release or external contribution.
