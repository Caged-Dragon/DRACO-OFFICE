# Changelog

All notable changes to DocWrite are documented here, one entry per release.
Format: `## vX — Theme` followed by what shipped.

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
