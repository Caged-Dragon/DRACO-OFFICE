# Draco Slides

Presentation editor in the Draco Office monorepo (`C:\CAGED_DRAGON\DRACO_OFFICE\draco-slides`). Current release: **v0.1.0**.

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
