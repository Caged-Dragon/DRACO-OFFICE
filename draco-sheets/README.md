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
`ROADMAP.md` lists v1–v100. After shipping versions, run `DONE=1,2,... PARTIAL=97 node scripts/gen-versions.mjs` to refresh the in-app Roadmap.
Icons: edit `public/icon.svg`, then `node scripts/make-icons.mjs`.

## Status (zip 4 / v0.4.0)
Test suites (all run against the real engine in headless Chromium):
- `tests/parity.py` — 31 checks, v11-v25 formatting (incl. real-click UI)
- `tests/formulas.py` — 308 formulas across Excel's categories (math, stats, logical, text, date, lookup, XLOOKUP, financial, info, engineering, database, dynamic arrays, LET/LAMBDA, array evaluation, names, cross-sheet). 307 pass.
- `tests/formula-ui.py` — 25 checks: Name Manager, auditing, error checking, watch window, F2/F4, copy/paste ref adjustment, spill, 3D refs
- `tests/audit.test.ts` — 24 unit tests for reference parsing, precedents/dependents, circular detection (`npx tsx tests/audit.test.ts`)

New in v0.4.0: **Formulas** dialog (Name Manager; Auditing = trace precedents/dependents + all-formulas list; Error checking incl. circular references; Watch window; Calculation).

### Known engine discrepancies vs Excel
- `DOLLAR()` returns a trailing space (`"$1,234.50 "`). Function overrides are ignored by the engine, so this can't be patched from the app.
- Spill-reference operator `A1#` is unsupported (`=SUM(A1#)` -> `#VALUE!`).
- Formula cells that get an auto number format (dates, currency) report their display text through the API instead of the number (calculation itself uses the number). Matters for v79 xlsx export - must be tested there.
- Default date format is `yyyy/mm/dd`; Excel en-US shows `m/d/yyyy`.
- Deleting a defined name gives `#REF!` in dependents (Excel: `#NAME?`).
- Circular references evaluate to 0 silently; Draco flags them in Formulas > Error checking.
- No Show Formulas view, no Evaluate Formula stepper, no manual-calculation mode, no iterative calculation.

### Roadmap state
Done: v1-v6, v10-v39, v41, v42. Partial: v7-v9 (cloud untested - Supabase not connected), v40, v43, v44, v45, v97.

## Known limits
- 100,000 rows x 10 cols + a formula per row recalculates in ~20 s (20,000 rows: < 1 s, UI stays responsive).
