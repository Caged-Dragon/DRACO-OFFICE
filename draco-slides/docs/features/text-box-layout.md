# Text box layout: margins, vertical alignment, overflow, fitting (v0.16.0)

Home tab > Text box group (enabled when a text object is selected or being edited). Like fonts and paragraphs these settings belong to the whole text object.

## Margins (and padding)
Four **internal margins** (T, R, B, L, 0 to 200 slide pixels, half-pixel steps): the space between the box edge and its text. On a freely placed text box an *outside* margin has no meaning, so "margins" and "padding" are the same setting here (PowerPoint calls it "internal margin"). The paragraph indent from Version 14 adds to the margin on the reading-start side. Existing objects keep 0 on all sides, so nothing moves when you upgrade.

## Vertical alignment
**Align top / middle / bottom** place the text inside the box. When the text is taller than the box, middle and bottom use `safe` alignment where the browser supports it, so overflow grows downward instead of disappearing above the box.

## Overflow
- **Clip overflow** (on by default, as before) hides text that does not fit; off lets it spill outside the box. While you edit, all text is shown regardless.
- A **warning** appears when text does not fit: the box outline turns red and the status bar adds "– text overflows the box". This is measured in the browser after every change; it cannot be measured in a test environment without layout.

## Fitting
Two one-shot commands, measured on the text exactly as drawn on the canvas:
- **Shrink to fit** finds the largest font size, never larger than the current one, at which the text fits the box (width and height) and applies it. If the text already fits it says so; if even 6 px is too big it applies 6 px and tells you to enlarge the box.
- **Fit box** sets the box height so it exactly holds the text (including margins), keeping position and width.

Both need the slide to be visible on screen; if it is not, nothing changes and you are told.

**Not built:** automatic live autofit (shrinking text as you type). The commands above are explicit on purpose: they are testable and never change your text size behind your back.

## Document model
Schema 7 adds `margins`, `verticalAlign` and `overflow` to text objects; migration from schema 6 uses the old look (0 margins, top, clipped).

## Limits
- Flexbox is used for vertical alignment, including on the editing surface. Chrome and Firefox edit block children of a flex container normally, but this has only been reasoned about, not tried in a real browser.
- Fitting is as accurate as the browser's layout of the box; fonts that load late or differ between machines can change the result.
