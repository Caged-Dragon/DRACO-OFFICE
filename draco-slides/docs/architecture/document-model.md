# Document model (schema version 9)

Source of truth: `src/core/document-model/types.ts`.

- **Presentation**: `id`, `title`, slide size (`width`, `height`, slide pixels, shared by all slides), `metadata`, `createdAt`, `updatedAt`, `slides[]`.
- **Metadata**: `author`, `description`, `language`, `createdWith` (app version that created the file).
- **Slide**: `id`, `name`, `objects[]` (back to front).
- **Objects**: every object extends `BaseObject` (`id`, `name`, `x`, `y`, `width`, `height`, `rotation` in degrees, `visible`, `groupId`, `locked`). `TextObject` adds `role` (`title` and `body` placeholders, or `textbox` for free text boxes), `text` and the formatting fields of `TextFormat` (`fontFamily`, `fontSize`, `bold`, `italic`, `underline`, `strike`, `color`; one format per object) and the `ParagraphFormat` fields (`align`, `indent`, `lineSpacing`, `direction`, `list`, also one per object). The box fields (`margins`, `verticalAlign`, `overflow`) say how the text sits inside its box. A paragraph's list level is stored as leading tabs in `text` (`core/document-model/lists.ts`). New object kinds extend the `SlideObject` union.
- **Slide sizes**: presets in `sizes.ts` (16:9 960x540, 4:3 960x720, 16:10 960x600). Dimensions are validated to 100..20000.
- **IDs** are unique across the whole document (slides and objects together).

## Loading and migration
All stored documents go through `parsePresentation` (`core/serialization/migrate.ts`):
1. Older schemas are upgraded by pure functions in sequence (v1 -> v2 adds metadata and object name/rotation/visible; v2 -> v3 allows the `textbox` role, no data change; v3 -> v4 adds text formatting, titles become bold; v4 -> v5 adds paragraph settings with the previous look as defaults; v5 -> v6 adds `list`, default none; v6 -> v7 adds the box fields with the previous look as defaults; v7 -> v8 adds `groupId` and `locked`, nothing grouped or locked; v8 -> v9 adds the shape fields `shape`, `fill`, `stroke`, `strokeWidth`, `flipV`, every existing object becoming an unfilled rectangle). Every object is a shape that can hold text; lines carry none. Groups are flat (shared `groupId`, one level, at least two members); see `core/document-model/groups.ts`.
2. The result is checked by `validatePresentation` (`core/validation`).
3. Unknown/future versions and invalid records are rejected and skipped, never deleted or guessed at.

Upgraded documents are written back in the new schema the next time they are saved.

## Changing the schema
Bump `DOCUMENT_SCHEMA_VERSION`, add a migration from the previous version, extend validation, and add a fixture test.
