import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { SETTINGS_KEY } from "../../src/services/settings/settingsStore";

const openSettings = () => {
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  return within(screen.getByRole("dialog", { name: "Settings" }));
};
const save = (d: ReturnType<typeof openSettings>) => fireEvent.click(d.getByRole("button", { name: "Save" }));

describe("Settings", () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    vi.restoreAllMocks();
  });

  it("defaults to the dark theme when the system gives no preference", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Your presentations" });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("applies and remembers a chosen theme", async () => {
    render(<App />);
    const d = openSettings();
    fireEvent.change(d.getByLabelText("Theme"), { target: { value: "light" } });
    save(d);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}").theme).toBe("light");
  });

  it("restores a saved theme on the next start", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: "light" }));
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("Cancel and Escape change nothing", () => {
    render(<App />);
    let d = openSettings();
    fireEvent.change(d.getByLabelText("Theme"), { target: { value: "light" } });
    fireEvent.click(d.getByRole("button", { name: "Cancel" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    d = openSettings();
    fireEvent.change(d.getByLabelText("Theme"), { target: { value: "light" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
  });

  it("Reset to defaults only resets the form until saved", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: "light", defaultAuthor: "Ana" }));
    render(<App />);
    const d = openSettings();
    expect(d.getByLabelText("Default author name")).toHaveValue("Ana");
    fireEvent.click(d.getByRole("button", { name: "Reset to defaults" }));
    expect(d.getByLabelText("Default author name")).toHaveValue("");
    expect(d.getByLabelText("Theme")).toHaveValue("system");
    expect(document.documentElement.dataset.theme).toBe("light"); // not applied yet
  });

  it("the default slide size is used for the next new presentation", async () => {
    render(<App />);
    const d = openSettings();
    fireEvent.change(d.getByLabelText("Default slide size"), { target: { value: "4:3" } });
    save(d);
    expect(screen.getByLabelText("Slide size")).toHaveValue("4:3");
    fireEvent.click(screen.getByRole("button", { name: "New presentation" }));
    expect(await screen.findByText("960 × 720")).toBeInTheDocument();
  });

  it("the default author is stored on new presentations", async () => {
    render(<App />);
    const d = openSettings();
    fireEvent.change(d.getByLabelText("Default author name"), { target: { value: "Ana Roy" } });
    save(d);
    fireEvent.click(screen.getByRole("button", { name: "New presentation" }));
    fireEvent.click(await screen.findByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Properties" }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Author")).toHaveValue("Ana Roy");
  });

  it("panes can be hidden by default", async () => {
    render(<App />);
    const d = openSettings();
    fireEvent.click(d.getByLabelText("Show the slide pane when a presentation opens"));
    fireEvent.click(d.getByLabelText("Show the text panel when a presentation opens"));
    save(d);
    fireEvent.click(screen.getByRole("button", { name: "New presentation" }));
    await screen.findByRole("group", { name: "Slide canvas" });
    expect(screen.queryByRole("navigation", { name: "Slides" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Body text")).not.toBeInTheDocument();
  });

  it("tells the user when settings cannot be stored, but still applies them", async () => {
    render(<App />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const d = openSettings();
    fireEvent.change(d.getByLabelText("Theme"), { target: { value: "light" } });
    save(d);
    expect(await screen.findByText(/Settings could not be saved/)).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("keeps Tab focus inside the dialog", () => {
    render(<App />);
    const d = openSettings();
    const buttons = d.getAllByRole("button");
    const last = buttons[buttons.length - 1];
    const first = d.getByLabelText("Theme");
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("returns focus to the Settings button when closed", async () => {
    render(<App />);
    const trigger = screen.getByRole("button", { name: "Settings" });
    trigger.focus(); // a real click focuses the button; fireEvent.click does not
    openSettings();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
