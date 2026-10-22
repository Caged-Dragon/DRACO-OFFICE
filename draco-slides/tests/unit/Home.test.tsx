import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import type { Presentation } from "../../src/core/document-model/types";
import { Home } from "../../src/features/home/Home";
import { deletePresentation, savePresentation } from "../../src/services/storage/presentationStore";

const noop = () => {};

describe("Home", () => {
  it("filters recent presentations and opens one", async () => {
    await savePresentation(createPresentation("Alpha plan"));
    const beta = createPresentation("Beta review");
    await savePresentation(beta);
    const onOpen = vi.fn();
    render(<Home onNew={noop} onOpen={onOpen} onImportFile={noop} />);

    expect(await screen.findByText("Alpha plan")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search recent presentations"), { target: { value: "beta" } });
    expect(screen.queryByText("Alpha plan")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Beta review"));
    expect(onOpen).toHaveBeenCalledWith(beta.id);
  });

  it("passes the typed title to onNew", () => {
    const onNew = vi.fn();
    render(<Home onNew={onNew} onOpen={noop} onImportFile={noop} />);
    fireEvent.change(screen.getByLabelText("Title (optional)"), { target: { value: "Q4 deck" } });
    fireEvent.click(screen.getByRole("button", { name: "New presentation" }));
    expect(onNew).toHaveBeenCalledWith("Q4 deck", "16:9");
  });

  it("passes the chosen slide size to onNew", () => {
    const onNew = vi.fn();
    render(<Home onNew={onNew} onOpen={noop} onImportFile={noop} />);
    fireEvent.change(screen.getByLabelText("Slide size"), { target: { value: "4:3" } });
    fireEvent.click(screen.getByRole("button", { name: "New presentation" }));
    expect(onNew).toHaveBeenCalledWith("", "4:3");
  });

  it("hands a chosen file to onImportFile", () => {
    const onImportFile = vi.fn();
    render(<Home onNew={noop} onOpen={noop} onImportFile={onImportFile} />);
    const file = new File(["{}"], "deck.draco-slides.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Presentation file"), { target: { files: [file] } });
    expect(onImportFile).toHaveBeenCalledWith(file);
  });

  it("tells the user about unreadable records without deleting them", async () => {
    await savePresentation({ id: "junk-home-1", schemaVersion: 2 } as unknown as Presentation);
    render(<Home onNew={noop} onOpen={noop} onImportFile={noop} />);
    expect(await screen.findByRole("note")).toHaveTextContent(/could not be read\. They were kept, not deleted/);
    await deletePresentation("junk-home-1");
  });
});
