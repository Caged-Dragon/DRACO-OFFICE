# Document model (schema version 3)

Source of truth: `src/core/document-model/types.ts`.

- **Presentation**: `id`, `title`, slide size (`width`, `height`, slide pixels, shared by all slides), `metadata`, `createdAt`, `updatedAt`, `slides[]`.
- **Metadata**: `author`, `description`, `language`, `createdWith` (app version that created the file).
- **Slide**: `id`, `name`, `objects[]` (back to front).
- **Objects**: every object extends `BaseObject` (`id`, `name`, `x`, `y`, `width`, `height`, `rotation` in degrees, `visible`). `TextObject` adds `role` (`title` and `body` placeholders, or `textbox` for free text boxes), `text`, `fontSize`. New object kinds extend the `SlideObject` union.
- **Slide sizes**: presets in `sizes.ts` (16:9 960x540, 4:3 960x720, 16:10 960x600). Dimensions are validated to 100..20000.
- **IDs** are unique across the whole document (slides and objects together).

## Loading and migration
All stored documents go through `parsePresentation` (`core/serialization/migrate.ts`):
1. Older schemas are upgraded by pure functions in sequence (v1 -> v2 adds metadata and object name/rotation/visible; v2 -> v3 allows the `textbox` role, no data change).
2. The result is checked by `validatePresentation` (`core/validation`).
3. Unknown/future versions and invalid records are rejected and skipped, never deleted or guessed at.

Upgraded documents are written back in the new schema the next time they are saved.

## Changing the schema
Bump `DOCUMENT_SCHEMA_VERSION`, add a migration from the previous version, extend validation, and add a fixture test.
