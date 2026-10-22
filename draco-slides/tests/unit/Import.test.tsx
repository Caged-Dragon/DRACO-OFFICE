import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createPresentation } from "../../src/core/document-model/factory";
import { MAX_FILE_BYTES, serializePresentation } from "../../src/core/serialization/serialize";
import { getPresentation, listPresentations } from "../../src/services/storage/presentationStore";

const fileFor = (text: string, name = "deck.draco-slides.json") => new File([text], name, { type: "application/json" });
const pick = (file: File) =>
  fireEvent.change(screen.getByLabelText("Presentation file"), { target: { files: [file] } });
const openApp = async () => {
  render(<App />);
  await screen.findByRole("heading", { name: "Your presentations" });
};

describe("Open from file", () => {
  it("opens a valid file in the editor and stores it", async () => {
    const p = createPresentation("Imported deck alpha");
    await openApp();
    pick(fileFor(serializePresentation(p, "test")));
    expect(await screen.findByRole("textbox", { name: "Presentation title" })).toHaveValue("Imported deck alpha");
    expect(await screen.findByText(/Opened "Imported deck alpha" from deck\.draco-slides\.json/)).toBeInTheDocument();
    await waitFor(async () => expect(await getPresentation(p.id)).not.toBeNull());
  });

  it("importing a file whose id is already stored makes a separate copy instead of overwriting", async () => {
    const p = createPresentation("Imported deck beta");
    const text = serializePresentation(p, "test");
    await openApp();
    pick(fileFor(text));
    await screen.findByRole("textbox", { name: "Presentation title" });
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close presentation" }));
    await screen.findByRole("heading", { name: "Your presentations" });

    pick(fileFor(text));
    expect(await screen.findByRole("textbox", { name: "Presentation title" })).toHaveValue("Imported deck beta (imported)");
    const titles = (await listPresentations()).map((x) => x.title);
    expect(titles).toContain("Imported deck beta");
    expect(titles).toContain("Imported deck beta (imported)");
  });

  it("shows a clear error for a file that is not a presentation, and stays on Home", async () => {
    await openApp();
    pick(fileFor("this is not json"));
    expect(await screen.findByText(/not valid JSON/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your presentations" })).toBeInTheDocument();
  });

  it("refuses files over the size limit without reading them", async () => {
    await openApp();
    const big = fileFor("{}");
    Object.defineProperty(big, "size", { value: MAX_FILE_BYTES + 1 });
    pick(big);
    expect(await screen.findByText(/too large/)).toBeInTheDocument();
  });
});
