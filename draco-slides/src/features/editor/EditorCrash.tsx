interface Props {
  onReload: () => void;
  onSaveCopy: () => void;
  onClose: () => void;
}

export function EditorCrash({ onReload, onSaveCopy, onClose }: Props) {
  return (
    <div className="crash" role="alert">
      <h2>The editor ran into a problem</h2>
      <p>
        Your presentation was autosaved in this browser, so you can restore it. Edits made in the last moment before
        the problem may not be included.
      </p>
      <div className="crash__actions">
        <button className="btn btn--primary" onClick={onReload}>
          Reload last saved version
        </button>
        <button className="btn" onClick={onSaveCopy}>
          Save a copy of the last saved version
        </button>
        <button className="btn" onClick={onClose}>
          Close presentation
        </button>
      </div>
    </div>
  );
}
