import type { Presentation } from "../document-model/types";

/**
 * Rebuilds a validated presentation from known fields only, so unexpected extra data in an imported
 * file is never carried into storage. Extend together with the object union when new object kinds arrive.
 */
export function sanitizePresentation(p: Presentation): Presentation {
  return {
    schemaVersion: p.schemaVersion,
    id: p.id,
    title: p.title.slice(0, 200),
    width: p.width,
    height: p.height,
    metadata: {
      author: p.metadata.author.slice(0, 200),
      description: p.metadata.description.slice(0, 2000),
      language: p.metadata.language.slice(0, 35),
      createdWith: p.metadata.createdWith.slice(0, 100),
    },
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    slides: p.slides.map((s) => ({
      id: s.id,
      name: s.name.slice(0, 100),
      objects: s.objects.map((o) => ({
        id: o.id,
        type: o.type,
        name: o.name.slice(0, 100),
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        rotation: o.rotation,
        visible: o.visible,
        role: o.role,
        text: o.text,
        fontSize: o.fontSize,
      })),
    })),
  };
}
