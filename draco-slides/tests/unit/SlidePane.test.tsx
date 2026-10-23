import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";

async function openEditor() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
}
const thumbs = () =>
  within(screen.getByRole("navigation", { name: "Slides" })).getAllByRole("button", { name: /^Slide \d+:/ });
const labels = () => thumbs().map((b) => b.getAttribute("aria-label"));

describe("Slide management UI", () => {
  afterEach(() => vi.restoreAllMocks());

  it("duplicates the current slide", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate slide" }));
    expect(screen.getByText("Slide 2 of 2")).toBeInTheDocument();
    expect(labels()).toEqual(["Slide 1: Slide 1", "Slide 2: Slide 1 (copy)"]);
  });

  it("renames a slide through the dialog and returns focus to the button", async () => {
    await openEditor();
    const trigger = screen.getByRole("button", { name: "Rename slide" });
    trigger.focus(); // a real click focuses the button; fireEvent.click does not
    fireEvent.click(trigger);
    const dialog = within(screen.getByRole("dialog", { name: "Rename slide" }));
    fireEvent.change(dialog.getByLabelText("Slide name"), { target: { value: "Intro" } });
    fireEvent.click(dialog.getByRole("button", { name: "Rename" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(labels()).toEqual(["Slide 1: Intro"]);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("does not allow a blank slide name", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Rename slide" }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Slide name"), { target: { value: "  " } });
    expect(dialog.getByRole("button", { name: "Rename" })).toBeDisabled();
    expect(dialog.getByRole("alert")).toHaveTextContent("needs a name");
  });

  it("moves slides with the ribbon buttons and disables them at the ends", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "New slide" })); // Slide 2 selected
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move up" }));
    expect(labels()).toEqual(["Slide 1: Slide 2", "Slide 2: Slide 1"]);
    expect(screen.getByText("Slide 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
  });

  it("reorders with Alt+Arrow on a thumbnail", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    fireEvent.keyDown(thumbs()[0], { key: "ArrowDown", altKey: true });
    expect(labels()).toEqual(["Slide 1: Slide 2", "Slide 2: Slide 1"]);
  });

  it("reorders by drag and drop", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    const items = within(screen.getByRole("navigation", { name: "Slides" })).getAllByRole("listitem");
    const dataTransfer = { setData: () => {}, effectAllowed: "" };
    fireEvent.dragStart(items[0], { dataTransfer });
    fireEvent.dragOver(items[1], { dataTransfer });
    fireEvent.drop(items[1], { dataTransfer });
    expect(labels()).toEqual(["Slide 1: Slide 2", "Slide 2: Slide 1"]);
  });

  it("asks before deleting and keeps the slide when cancelled", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete slide" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(thumbs()).toHaveLength(2);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete slide" }));
    expect(thumbs()).toHaveLength(1);
  });

  it("returns focus to the File button after closing Properties with Escape", async () => {
    await openEditor();
    const file = screen.getByRole("button", { name: "File" });
    fireEvent.click(file);
    fireEvent.click(screen.getByRole("menuitem", { name: "Properties" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(file).toHaveFocus());
  });
});
