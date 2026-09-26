# DocWrite

**A cross-platform, offline-first document editor** — a from-scratch, incrementally built alternative to Microsoft Word and Google Docs, developed and released in 100 versioned stages.

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Version](https://img.shields.io/badge/version-v0.15.0-blue)
![License](https://img.shields.io/badge/license-unset-lightgrey)

---

## Table of Contents

- [Overview](#overview)
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

## Features

Current as of **v0.15.0**. Checked items are shipped; the rest are on the [Roadmap](#roadmap).

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
- [ ] Word count, spell check, templates, styles, and more — see Roadmap

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
| v11–v20   | Tables, images, links, headers/footers, find & replace, spell check, templates, styles — 🚧 in progress (v15/v20) |
| v21–v30   | Comments, track changes, footnotes, TOC, references, print, PDF export |
| v31–v50   | `.docx`/`.rtf`/`.odt` import-export, drawing, equations, charts, accessibility, performance polish |
| v51–v100  | Real-time collaboration, cloud sync, and beyond — scoped separately |

## Known Limitations

Tracked honestly as they're found, not hidden. Full detail in `CHANGELOG.md`; summary:

- **Images** are embedded as base64, inflating `.dwdoc` file size ~33% versus the source file. No asset storage backend yet.
- **Find & Replace** only matches text within a single formatting run — a match split across a bold/italic boundary won't be found.
- **Page numbering** is a static placeholder ("Page 1") until real multi-page pagination lands alongside print support.

## Contributing

This project is currently developed as a solo, versioned build-in-public effort. Issues and suggestions are welcome via the repository's issue tracker.

## License

**Not yet chosen.** Add a `LICENSE` file before any public release or external contribution.
