import { useId, useState } from "react";
import type { Presentation } from "../../core/document-model/types";

interface Props {
  presentation: Presentation;
  onSave: (values: { title: string; author: string; description: string }) => void;
  onClose: () => void;
}

export function PropertiesDialog({ presentation, onSave, onClose }: Props) {
  const id = useId();
  const [title, setTitle] = useState(presentation.title);
  const [author, setAuthor] = useState(presentation.metadata.author);
  const [description, setDescription] = useState(presentation.metadata.description);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-heading`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <h2 id={`${id}-heading`}>Presentation properties</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ title, author, description });
          }}
        >
          <label className="field">
            <span>Title</span>
            <input autoFocus value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>Author</span>
            <input value={author} maxLength={200} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea rows={3} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <dl className="props">
            <dt>Slide size</dt>
            <dd>
              {presentation.width} × {presentation.height}
            </dd>
            <dt>Slides</dt>
            <dd>{presentation.slides.length}</dd>
            <dt>Created</dt>
            <dd>{new Date(presentation.createdAt).toLocaleString()}</dd>
            <dt>Last modified</dt>
            <dd>{new Date(presentation.updatedAt).toLocaleString()}</dd>
            <dt>Created with</dt>
            <dd>{presentation.metadata.createdWith}</dd>
          </dl>
          <div className="modal__actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
