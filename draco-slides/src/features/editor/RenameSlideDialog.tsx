import { useState } from "react";
import { Modal } from "../../components/dialogs/Modal";

interface Props {
  currentName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

export function RenameSlideDialog({ currentName, onSave, onClose }: Props) {
  const [name, setName] = useState(currentName);
  const blank = name.trim() === "";

  return (
    <Modal title="Rename slide" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!blank) onSave(name);
        }}
      >
        <label className="field">
          <span>Slide name</span>
          <input autoFocus value={name} maxLength={100} onFocus={(e) => e.target.select()} onChange={(e) => setName(e.target.value)} />
        </label>
        {blank && <p className="error" role="alert">A slide needs a name.</p>}
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={blank}>
            Rename
          </button>
        </div>
      </form>
    </Modal>
  );
}
