import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { deserializePresentation } from "../../src/core/serialization/serialize";
import { savePresentation } from "../../src/services/storage/presentationStore";
import { StorageError } from "../../src/services/storage/storageError";
import { downloadTextFile } from "../../src/utils/download";

vi.mock("../../src/services/storage/presentationStore", () => ({
  savePresentation: vi.fn(),
  getPresentation: vi.fn(),
  deletePresentation: vi.fn(),
  recordExists: vi.fn(),
  listPresentations: vi.fn(),
  listPresentationsDetailed: vi.fn(),
}));
vi.mock("../../src/utils/download", () => ({ startDownload: vi.fn(), downloadTextFile: vi.fn() }));

const save = vi.mocked(savePresentation);

async function openEditor() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
}
const rename = (title: string) =>
  fireEvent.change(screen.getByRole("textbox", { name: "Presentation title" }), { target: { value: title } });

describe("Editor persistence", () => {
  beforeEach(async () => {
    save.mockReset();
    save.mockResolvedValue(undefined);
    vi.mocked(downloadTextFile).mockReset();
    const store = await import("../../src/services/storage/presentationStore");
    vi.mocked(store.listPresentationsDetailed).mockResolvedValue({ presentations: [], unreadable: 0 });
  });

  it("explains a failed save, offers Retry and Download backup, and recovers", async () => {
    await openEditor();
    save.mockRejectedValue(new StorageError("quota", "full"));
    rename("Draft one");
    expect(await screen.findByText(/Could not save\. Browser storage is full\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download backup" }));
    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [name, text] = vi.mocked(downloadTextFile).mock.calls[0];
    expect(name).toBe("Draft one.draco-slides.json");
    const parsed = deserializePresentation(text);
    expect(parsed.ok && parsed.presentation.title).toBe("Draft one");

    save.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Saved in this browser")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("warns before leaving the page only while changes are unsaved", async () => {
    await openEditor();
    rename("Unsaved title");
    const during = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);

    await screen.findByText("Saved in this browser");
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it("saves immediately when the page is hidden, without waiting for the debounce", async () => {
    await openEditor();
    rename("Flush me");
    const before = save.mock.calls.length;
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(save.mock.calls.length).toBe(before + 1);
    expect(save.mock.calls.at(-1)?.[0].title).toBe("Flush me");
  });

  it("tells the user when closing the editor could not store the last edit", async () => {
    await openEditor();
    save.mockRejectedValue(new StorageError("unavailable", "blocked"));
    rename("Lost?");
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close presentation" }));
    expect(await screen.findByText(/Could not save "Lost\?"/)).toBeInTheDocument();
  });

  it("File > Save a copy to file downloads a readable file", async () => {
    await openEditor();
    rename("My deck");
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Save a copy to file" }));
    const [name, text] = vi.mocked(downloadTextFile).mock.calls[0];
    expect(name).toBe("My deck.draco-slides.json");
    expect(deserializePresentation(text).ok).toBe(true);
  });
});
