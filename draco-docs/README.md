# DocWrite

A cross-platform, offline-first document editor — a from-scratch, incrementally
built alternative to Word/Google Docs. Web app, installable PWA, and (from later
versions) packaged for Android, iOS, Windows, and macOS from one codebase.

## Release plan

Built in 100 versions, released as tagged GitHub Releases (zip/installer per tag,
published automatically by `.github/workflows/release.yml`).
Versions 1–50 cover a complete offline-first single-user editor with .docx
import/export. Versions 51–100 (collaboration, cloud sync, and beyond) TBD.

**Tag scheme:** `v0.01.0` → `v0.99.0` = versions 1–99, `v1.00.0` = version 100.
To ship a version, tag it and push:

```bash
git tag v0.02.0   # for version 2
git push --tags
```

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

## Current version: v9 — Page Layout

The editor now renders as a real page (Letter/A4/Legal, portrait/landscape,
with margin presets) at `/editor`. Local save/load of named documents lands in v10.
