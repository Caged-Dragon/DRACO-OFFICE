# Slide management (v0.6.0)

| Action | Ribbon (Home) | Other |
|---|---|---|
| New slide | New slide | Inserted after the current slide; gets the next unused "Slide N" name |
| Duplicate | Duplicate slide | Copy gets new ids, name "<name> (copy)", inserted after the original and selected |
| Rename | Rename slide | Dialog; blank names are refused; max 100 characters |
| Delete | Delete slide | Asks for confirmation (no undo until a later release); the last slide cannot be deleted |
| Reorder | Move up / Move down | Drag a thumbnail onto another; or focus a thumbnail and press Alt+Up / Alt+Down |
| Navigate | Previous / Next | PageUp / PageDown |

Selection follows the slide (by id) when slides are reordered.

Limits: no multi-select, no copy/paste of slides, no undo/redo, no section grouping yet.

## Slide pane (v0.7.0)
- Click a thumbnail to select it. Up/Down arrows move between slides, Home/End jump to first/last. Alt+Up/Alt+Down reorder.
- Only the selected thumbnail is a Tab stop; Tab leaves the pane.
- Selection changes from anywhere scroll the selected thumbnail into view; focus follows only if it was already inside the pane.
- Thumbnails of unchanged slides are not re-rendered while another slide is being edited.
