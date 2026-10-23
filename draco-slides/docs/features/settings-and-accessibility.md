# Settings, errors and accessibility (v0.10.0)

## Settings (top bar > Settings)
Stored in the browser's localStorage under `draco-slides:settings`; invalid values fall back to defaults field by field. If storage is blocked the settings still apply for the session and an error message says they will not be remembered.
- **Theme**: match system (default), dark or light.
- **Default slide size** and **default author name** for new presentations.
- Whether the **slide pane** and **text panel** are shown when a presentation opens.
Save applies everything; Cancel/Escape discards; Reset to defaults only changes the form until saved.

## Error handling
- A render error in the editor shows a recovery screen: reload the last autosaved version, save a copy of it, or close. The rest of the app keeps working.
- A render error anywhere else shows a minimal reload screen; stored presentations are not affected.
- Uncaught errors and unhandled promise rejections show one message (at most every 5 seconds) and are logged via `utils/logger.ts`.

## Accessibility foundations
- Landmarks (banner, main, navigation), skip link, visible focus, labelled controls, ribbon tabs with arrow-key navigation, menus with arrow keys/Escape/focus return.
- Dialogs trap Tab, close on Escape and return focus to where they were opened.
- Slide changes are announced politely to screen readers (not when slides are only reordered).
- Both themes meet WCAG AA contrast (4.5:1) for every text/background pair in use, enforced by a test.
- Not yet done: manual screen-reader testing, high-contrast/forced-colours checks, reduced-motion handling (nothing animates yet), touch accessibility. See Version 95.
