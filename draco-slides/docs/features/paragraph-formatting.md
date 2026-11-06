# Paragraph formatting (v0.14.0)

Home tab > Paragraph group (enabled when a text object is selected or being edited). Like font formatting, these settings apply to the **whole text object**; different paragraphs in one object cannot have different settings yet.

| Setting | Control | Shortcut |
|---|---|---|
| Alignment: left, center, right, justify | four toggle buttons (one is always pressed) | Ctrl/Cmd+L, E, R, J |
| Indent: 0 to 8 levels of 36 slide pixels | Indent - / Indent + (disabled at the ends) | |
| Line spacing: 1.0, 1.2 (the default), 1.5, 2.0, 2.5, 3.0 | drop-down; an unusual value from an imported file stays listed | |
| Text direction: left-to-right, right-to-left | LTR / RTL toggle buttons | |

## Behaviour
- **Direction** is the HTML `dir` attribute, so the browser lays out bidirectional text (Arabic, Hebrew, mixed with Latin) itself. Switching direction also mirrors a left or right alignment (right-to-left text starts on the right) unless the same change sets the alignment explicitly; centered and justified text are left alone.
- **Indent** is measured from the reading-start edge: the left edge in left-to-right text, the right edge in right-to-left text. Titles and bodies can be indented too.
- **Alignment** is physical (left means left), as in PowerPoint. Justify aligns all lines except the last of each paragraph.
- While editing, ribbon buttons keep focus in the editor and the settings apply immediately without touching the typed text. Ctrl+L/E/R/J in the editor are routed to the same settings instead of the browser's own justify commands. The line-spacing list moves focus out of the editor, which ends editing (the object stays selected; press Enter to continue).
- Ctrl+L and Ctrl+R are also browser shortcuts (address bar, reload) on some systems; they are only taken over when a text object is selected and the canvas has focus, and may still be reserved by the browser.

## Document model
Schema 5 adds `align`, `indent` (whole levels), `lineSpacing` (multiple of the font size, 0.5 to 5) and `direction` to text objects. Migration from schema 4 uses the values text already rendered with (left, 0, 1.2, ltr). Validation rejects anything else.

## Limits
- No per-paragraph settings, bullets or numbering (Version 15), margins or vertical alignment (Version 16).
- Space before and after paragraphs, first-line and hanging indents, and tab stops are not implemented.
- Right-to-left layout is delegated to the browser and is only unit-tested for the attribute and styles; real bidirectional behaviour has not been checked in a browser.
