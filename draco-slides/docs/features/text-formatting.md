# Text formatting (v0.13.0)

## What you can set
Home tab > Font group (enabled when a text object is selected, or being edited):
- **Font family** (Segoe UI, Arial, Verdana, Trebuchet MS, Georgia, Times New Roman, Courier New, Consolas). The stored value is the name; each has a CSS fallback stack for systems without the font.
- **Font size**: type a value (6 to 400, rounded to half a point) and press Enter or leave the field, or step with **A+** / **A-** through the usual presets (8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, ...).
- **Bold, Italic, Underline, Strikethrough**: toggle buttons (pressed state is announced). Ctrl/Cmd+B, I, U work with the object selected, and inside the text editor.
- **Text color**: the browser's color picker (stored as lowercase `#rrggbb`).

Titles start bold and larger; they can be un-bolded like anything else.

## Scope: whole-object formatting
Formatting applies to **the whole text object**, not to a selected range of characters. Mixing styles inside one object (one bold word in a sentence) is **not supported yet**. Doing that properly needs a character-level run model that stays in sync with the browser's editing DOM, which is a larger change than this version; it is the main gap against PowerPoint's behaviour.

## Why it does not disturb the caret
The editing surface is owned by the browser while you type. Changing the object's formatting only changes the CSS style of the surface's container; its children (the text and lines) are never touched, so the caret and selection stay exactly where they were. Ribbon buttons keep keyboard focus in the editor, so you can bold a text box and keep typing. Choosing from the font list, the size field or the color picker moves focus there, which ends the editing session (the object stays selected; press Enter to continue).

## Document model
Schema 4 adds `fontFamily`, `bold`, `italic`, `underline`, `strike`, `color` next to the existing `fontSize` on text objects. Migration from schema 3 keeps sizes and makes titles bold (as they looked before); validation accepts only known fonts and hex colors, so a file can never inject arbitrary CSS. Imports normalize colors to lowercase.
