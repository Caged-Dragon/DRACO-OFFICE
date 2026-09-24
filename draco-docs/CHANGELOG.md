# Changelog

All notable changes to DocWrite are documented here, one entry per release.
Format: `## vX — Theme` followed by what shipped.

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
