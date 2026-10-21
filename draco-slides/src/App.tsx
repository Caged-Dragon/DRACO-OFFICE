import { useCallback, useState } from "react";
import { createPresentation } from "./core/document-model/factory";
import type { Presentation } from "./core/document-model/types";
import { Editor } from "./features/editor/Editor";
import { Home } from "./features/home/Home";
import { getPresentation } from "./services/storage/presentationStore";

export default function App() {
  const [open, setOpen] = useState<Presentation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openById = useCallback(async (id: string) => {
    try {
      const p = await getPresentation(id);
      if (!p) throw new Error("That presentation is missing or unreadable.");
      setError(null);
      setOpen(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the presentation.");
    }
  }, []);

  if (open) {
    return <Editor key={open.id} initial={open} onClose={() => setOpen(null)} />;
  }
  return (
    <Home
      error={error}
      onNew={() => setOpen(createPresentation())}
      onOpen={openById}
    />
  );
}
