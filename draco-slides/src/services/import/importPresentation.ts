import { newId } from "../../core/document-model/factory";
import type { Presentation } from "../../core/document-model/types";

/**
 * An imported presentation never overwrites an existing local one: if its id is already taken
 * (for example the same file is opened twice) it is stored as a separate copy with a new id.
 */
export function prepareImport(p: Presentation, idAlreadyStored: boolean): Presentation {
  if (!idAlreadyStored) return p;
  return { ...p, id: newId(), title: `${p.title} (imported)`.slice(0, 200) };
}
