import { useState } from "react";
import { Modal } from "../../components/dialogs/Modal";
import { SLIDE_SIZE_IDS, SLIDE_SIZES, type SlideSizeId } from "../../core/document-model/sizes";
import { DEFAULT_SETTINGS, parseSettings, type Settings, type ThemeSetting } from "../../services/settings/settingsStore";

interface Props {
  settings: Settings;
  onSave: (next: Settings) => void;
  onClose: () => void;
}

export function SettingsDialog({ settings, onSave, onClose }: Props) {
  const [form, setForm] = useState<Settings>(settings);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal title="Settings" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(parseSettings(form));
        }}
      >
        <label className="field">
          <span>Theme</span>
          <select autoFocus value={form.theme} onChange={(e) => set("theme", e.target.value as ThemeSetting)}>
            <option value="system">Match my system</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className="field">
          <span>Default slide size</span>
          <select value={form.defaultSlideSize} onChange={(e) => set("defaultSlideSize", e.target.value as SlideSizeId)}>
            {SLIDE_SIZE_IDS.map((id) => (
              <option key={id} value={id}>
                {SLIDE_SIZES[id].label} · {SLIDE_SIZES[id].width} × {SLIDE_SIZES[id].height}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Default author name</span>
          <input value={form.defaultAuthor} maxLength={200} onChange={(e) => set("defaultAuthor", e.target.value)} />
        </label>
        <label className="checkrow">
          <input type="checkbox" checked={form.showSlidePane} onChange={(e) => set("showSlidePane", e.target.checked)} />
          <span>Show the slide pane when a presentation opens</span>
        </label>
        <label className="checkrow">
          <input type="checkbox" checked={form.showTextPanel} onChange={(e) => set("showTextPanel", e.target.checked)} />
          <span>Show the text panel when a presentation opens</span>
        </label>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={() => setForm({ ...DEFAULT_SETTINGS })}>
            Reset to defaults
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
