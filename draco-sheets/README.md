# Draco Sheets
Excel replacement as an installable, responsive PWA. Caged Dragon Studios.

Engine: Univer (grid, formulas, formatting) · Shell: React + Vite · Cloud: Supabase · Offline: IndexedDB + service worker.

## Run
```bash
npm install
cp .env.example .env     # add Supabase URL + publishable key (optional: works offline without it)
npm run dev              # http://localhost:5173
npm run build && npm run preview
```
Cloud sync: run `supabase/migrations/0001_init.sql` in your project (SQL editor or `supabase db push`), and enable Email and/or Google under Auth > Providers.

## Roadmap
`ROADMAP.md` lists v1–v100. After shipping versions, run `DONE=1,2,... node scripts/gen-versions.mjs` to refresh the in-app Roadmap.
Icons: edit `public/icon.svg`, then `node scripts/make-icons.mjs`.

## Status
Shipped: v1–v10 foundation (grid, PWA, responsive, undo/redo, clipboard, row/column ops, multi-sheet, Supabase schema + RLS, auth, autosave, open/new/rename/delete, offline cache).
Note: Univer's `preset-sheets-advanced` (charts, pivots, sparklines, print) is a paid license, so v61-v78 and v81-v82 are built in-house.
