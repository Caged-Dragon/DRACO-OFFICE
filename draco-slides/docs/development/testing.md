# Testing

## Layers
1. **Unit** (`tests/unit/*.test.ts`): pure logic: document model, reducers, validation, migration, serialization, geometry, settings, contrast.
2. **Component / integration** (`tests/unit/*.test.tsx`): whole screens rendered with React Testing Library against an in-memory IndexedDB (`fake-indexeddb`).
3. **Accessibility** (`tests/unit/accessibility.test.tsx`): axe-core on the main screens and dialogs, plus keyboard and focus tests and a WCAG contrast check of both themes.
4. **End to end** (`tests/e2e`): Playwright in Chromium against the dev server.

## What the baseline does and does not cover
- jsdom has no layout. Canvas tests rely on the viewport falling back to 800x500; real sizing, scrolling, drag and drop with a real mouse, and CSS rendering are only exercised by the Playwright tests.
- axe-core finds only a part of accessibility problems and cannot check colour contrast in jsdom (covered separately for the theme tokens). Manual keyboard and screen-reader testing is planned for Version 95.
- No coverage threshold is enforced yet; run `npm run test:coverage` to see the current numbers.
- Only Chromium is configured for e2e. Cross-browser testing is planned for Version 98.

## Before a release
`npm run verify`, then `npm run e2e` when a browser is available.
