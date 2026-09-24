# DocWrite

A cross-platform, offline-first document editor — a from-scratch, incrementally
built alternative to Word/Google Docs. Web app, installable PWA, and (from later
versions) packaged for Android, iOS, Windows, and macOS from one codebase.

## Release plan

Built in 100 versions, released as tagged GitHub Releases (zip/installer per tag).
Versions 1–50 cover a complete offline-first single-user editor with .docx
import/export. Versions 51–100 (collaboration, cloud sync, and beyond) TBD.

See `CHANGELOG.md` for what each version ships.

## Stack

- **Web core:** Next.js (App Router) + TypeScript + Tailwind CSS
- **PWA:** web app manifest + service worker (installable, offline app shell)
- **Mobile wrap (planned):** Capacitor → Android/iOS app store builds
- **Desktop wrap (planned):** Tauri → Windows/macOS installers

Same codebase powers the website, the installed PWA, and the wrapped native apps.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Current version: v1 — Project Foundation

Project scaffold, PWA installability, and base routing (dashboard / editor /
settings placeholders). The actual rich-text editing engine ships in v2.
