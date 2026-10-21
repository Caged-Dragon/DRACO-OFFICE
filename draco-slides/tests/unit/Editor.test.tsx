import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

async function openEditor() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
}

describe("Editor layout", () => {
  it("switches ribbon tabs and toggles the slide pane", async () => {
    await openEditor();
    expect(screen.getByRole("navigation", { name: "Slides" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "View" }));
    const toggle = screen.getByRole("button", { name: "Slide pane" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(screen.queryByRole("navigation", { name: "Slides" })).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("File > Close presentation returns to Home and disables Editor", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close presentation" }));
    expect(await screen.findByRole("heading", { name: "Your presentations" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editor" })).toBeDisabled();
  });

  it("PageUp and PageDown move between slides", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    expect(screen.getByText("Slide 2 of 2")).toBeInTheDocument();
    const stage = screen.getByRole("region", { name: "Slide editor" });
    fireEvent.keyDown(stage, { key: "PageUp" });
    expect(screen.getByText("Slide 1 of 2")).toBeInTheDocument();
    fireEvent.keyDown(stage, { key: "PageDown" });
    expect(screen.getByText("Slide 2 of 2")).toBeInTheDocument();
  });

  it("shows the slide size in the status bar", async () => {
    await openEditor();
    expect(screen.getByText("960 × 540")).toBeInTheDocument();
  });

  it("File > Properties edits and keeps the author", async () => {
    await openEditor();
    const open = () => {
      fireEvent.click(screen.getByRole("button", { name: "File" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Properties" }));
      return within(screen.getByRole("dialog", { name: "Presentation properties" }));
    };
    let dialog = open();
    fireEvent.change(dialog.getByLabelText("Author"), { target: { value: "Ana" } });
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    dialog = open();
    expect(dialog.getByLabelText("Author")).toHaveValue("Ana");
    expect(dialog.getByText("960 × 540")).toBeInTheDocument();
  });

  it("Escape closes the properties dialog without saving", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Properties" }));
    const dialog = screen.getByRole("dialog", { name: "Presentation properties" });
    fireEvent.change(within(dialog).getByLabelText("Author"), { target: { value: "Nobody" } });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Properties" }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Author")).toHaveValue("");
  });
});
