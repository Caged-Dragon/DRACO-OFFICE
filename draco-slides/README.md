# Draco Slides

Presentation editor in the Draco Office monorepo (`C:\CAGED_DRAGON\DRACO_OFFICE\draco-slides`). Current release: **v0.7.0**.

## Run (Windows CMD)
```cmd
cd C:\CAGED_DRAGON\DRACO_OFFICE\draco-slides
npm install
npm run dev
```
Other scripts: `npm run typecheck`, `npm test`, `npm run build`, `npm run preview`.

## Supabase (optional in v0.1.0)
Copy `.env.example` to `.env` and fill in the project URL and **publishable** key. Never use a secret/service-role key in this app. Without these values the app works locally only.

## Status
See `CHANGELOG.md` for what exists and what does not. No PowerPoint compatibility is claimed yet.

## Website and installable app
- **Website (Vercel):** import the monorepo in Vercel and set the project's *Root Directory* to `draco-slides`. `vercel.json` handles the build and routing. Set `VITE_GITHUB_REPO` in the Vercel project settings. Nothing is deployed by this repo's scripts.
- **Desktop app (install from the tag):** pushing a tag `draco-slides/vX.Y.Z` runs `ci/draco-slides-release.yml` (copy it to the monorepo root `.github/workflows/` first), which builds the Windows installer with Electron and attaches `Draco-Slides-Setup-X.Y.Z.exe` to that tag's GitHub release. The **Install** button (top right) downloads that file; running it installs the app. Inside the installed app the same button reads **Update** when a newer tag exists.
- **Latest tag badge:** shows the newest `draco-slides/v*` tag from `VITE_GITHUB_REPO` (public repo; no token is sent from the browser). Without it, the badge shows this build's version.
- **Fallbacks:** if the release has no installer for the user's system, Install uses the browser's PWA install prompt (Chrome/Edge) or opens the release page.
- **Build the installer locally (Windows):** `npm run dist:win` writes it to `release/`. Try the desktop shell without packaging: `npm run desktop:start`.
- The Windows installer is **unsigned**, so Windows SmartScreen may warn on first run. Code signing is not set up.
