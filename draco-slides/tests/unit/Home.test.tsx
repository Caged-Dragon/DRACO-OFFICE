import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPresentation } from "../../src/core/document-model/factory";
import { Home } from "../../src/features/home/Home";
import { savePresentation } from "../../src/services/storage/presentationStore";

describe("Home", () => {
  it("filters recent presentations and opens one", async () => {
    await savePresentation(createPresentation("Alpha plan"));
    const beta = createPresentation("Beta review");
    await savePresentation(beta);
    const onOpen = vi.fn();
    render(<Home onNew={() => {}} onOpen={onOpen} />);

    expect(await screen.findByText("Alpha plan")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search recent presentations"), { target: { value: "beta" } });
    expect(screen.queryByText("Alpha plan")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Beta review"));
    expect(onOpen).toHaveBeenCalledWith(beta.id);
  });

  it("passes the typed title to onNew", async () => {
    const onNew = vi.fn();
    render(<Home onNew={onNew} onOpen={() => {}} />);
    fireEvent.change(screen.getByLabelText("Title (optional)"), { target: { value: "Q4 deck" } });
    fireEvent.click(screen.getByRole("button", { name: "New presentation" }));
    expect(onNew).toHaveBeenCalledWith("Q4 deck");
  });
});
