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

## Status (zip 3 / v0.3.0)
Verified by `tests/parity.py` (31 checks driving the real engine, including real clicks): v11-v25 formatting parity — fonts, colors, alignment, indent, wrap, merge, all 13 border styles, number formats (General/Number/Currency/Accounting/Date/Time/Percent/Fraction/Scientific/Text/custom), Format Painter, Cell Styles gallery (new, 46 styles), rotation, shrink-to-fit, conditional formatting (highlight, data bars, color scales, icon sets, custom formula, top-N, manage/delete).
Also fixed: engine defaulted to Chinese locale (AM/PM showed as 下午, dates as 星期); workbooks now default to English.
Partial: v26 (formula bar/calc verified; F2/F4 modes untested), v33 (XLOOKUP/XMATCH verified; LOOKUP untested), v97 (worker + lazy load done).
Cloud (v7-v9): code written but NOT yet tested against a live Supabase project; marked partial until the Draco Office project is connected.

## Known limits
- 100,000 rows x 10 cols + a formula per row finishes recalculating in ~20 s (20,000 rows: under 1 s, UI stays responsive). Virtualized loading / incremental recalc planned in v97.

## Tests
```
npm run build && npx vite preview --port 4174 &
pip install playwright && playwright install chromium
python3 tests/parity.py     # feature parity
python3 tests/bench.py 20000   # performance
```
Shipped earlier: zip 1 = v1-v10 foundation; zip 2 = worker + lazy engine.
