# Developing Draco Slides

## Setup (Windows CMD)
```cmd
cd C:\CAGED_DRAGON\DRACO_OFFICE\draco-slides
npm install
npm run dev
```
Node 20 or newer. The dev server uses port 5175 and fails if it is taken (so the e2e tests always know where it is).

## Scripts
| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc -b` (strict) |
| `npm test` | Vitest unit and component tests (jsdom) |
| `npm run test:coverage` | Same, with a coverage report in `coverage/` (no threshold is enforced yet) |
| `npm run e2e` | Playwright smoke tests in a real browser (first run: `npx playwright install chromium`) |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run verify` | typecheck, tests and build in one go: run this before every release |
| `npm run build:desktop`, `dist:win` | Desktop (Electron) build and Windows installer |

## Source layout
- `src/core/`: framework-free logic. `document-model` (types, factory, sizes), `validation`, `serialization` (migrate, file format, sanitize), `geometry` (zoom/pan maths). No React here.
- `src/state/`: reducers and React contexts (`appReducer`, `editorReducer`, settings).
- `src/services/`: browser and network services: IndexedDB `storage`, `settings` (localStorage), `import`, `release` (GitHub tags and installers), `supabase`.
- `src/features/`: UI by feature (`home`, `editor`, `canvas`, `ribbon`, `release`, `settings`).
- `src/components/`: shared UI (`layout`, `menus`, `dialogs`, `notifications`, `common`).
- `tests/unit` (Vitest), `tests/e2e` (Playwright).

## Conventions
- Document changes go through the editor reducer; the reducer is pure and covered by tests.
- Anything read from storage or a file goes through `parsePresentation` / `deserializePresentation`. Changing the stored shape needs a schema bump and a migration (see `docs/architecture/document-model.md`).
- Never swallow a save failure: surface it (see `docs/features/persistence.md`).
- Dialogs use `components/dialogs/Modal` (focus trap, Escape, focus return). Menus use `MenuButton`.
- Colours come from the CSS variables in `global.css`; both themes must keep passing `tests/unit/contrast.test.ts`.
- Use the logger (`utils/logger.ts`) rather than bare `console.error`.
