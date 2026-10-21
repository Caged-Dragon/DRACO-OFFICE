# Draco Slides

Presentation editor in the Draco Office monorepo (`C:\CAGED_DRAGON\DRACO_OFFICE\draco-slides`). Current release: **v0.3.0**.

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
- **Website (Vercel):** import the monorepo in Vercel and set the project's *Root Directory* to `draco-slides`. `vercel.json` handles the build and single-page routing. Set `VITE_GITHUB_REPO` (and, later, the Supabase variables) in the Vercel project settings. Nothing is deployed by this repo's scripts.
- **Installable app:** the same build is a PWA (`manifest.webmanifest`, `sw.js`). The **Install** button at the top right uses the browser's install prompt (Chrome/Edge). Where the browser offers none (Safari, Firefox), it opens the GitHub release page.
- **Latest tag:** the top-right badge shows the newest `draco-slides/v*` tag from the repo in `VITE_GITHUB_REPO` (must be public; no token is sent from the browser). Without it, the badge shows this build's version.
- A native desktop installer (.exe/.msi attached to GitHub releases) is **not** part of v0.3.0.
