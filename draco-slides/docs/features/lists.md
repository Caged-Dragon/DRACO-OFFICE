# Lists: bullets, numbering and levels (v0.15.0)

Home tab > List group (enabled when a text object is selected or being edited).

- **Bullets** and **Numbering** are toggles: pressing the active one turns the list off; pressing the other switches. The list style belongs to the whole text object (every paragraph shows a marker), like the other paragraph settings.
- **Level +** / **Level −** (Increase / Decrease list level) move paragraphs between levels 0 and 8. With the object selected they move **every** paragraph. While editing they move only the paragraphs touched by the selection or caret. They need a list to be active.
- **Tab / Shift+Tab** in the editor do the same for the paragraph with the caret when the object is a list. Tab is left alone otherwise. Press **Escape** to leave the editor with the keyboard.
- Markers: bullets cycle • – ▪ by level; numbers use 1. a. i. by level and restart under each higher level. Empty paragraphs keep their marker. Markers follow the text direction (they sit on the right in right-to-left text) and the object's indent setting still applies on top.

## How it works
- A paragraph's level is the number of **leading tab characters** in the object's text (an outline in plain text), so the text remains the single source of truth and the Text panel, files and thumbnails all agree. Without a list, levels simply indent the paragraph.
- Markers are drawn by the stylesheet (CSS counters on the lines), not stored. Because they depend only on the order of lines and a `data-level` attribute, they keep working while the browser splits and creates lines as you type. The editor reads `data-level` back into tabs on every input.
- Schema 6 adds `list` (`none`, `bullet`, `number`). Migration from schema 5 sets `none`, so nothing changes visually.

## Limits
- One list style per object, not per paragraph; no custom bullet characters or number formats, no "start at" or restart-numbering command.
- Markers are generated content: screen readers may announce them as text, and the slide canvas is an image to assistive technology anyway. Real list semantics (`<ul>/<ol>`) are not used.
- It is assumed, but not verified in real browsers, that Enter copies `data-level` to the new line (Chrome and Firefox clone the line element; if a browser does not, the new line starts at level 0).
- Typing a Tab in the Text panel moves focus instead of adding a level; use the buttons or paste text containing tabs.
