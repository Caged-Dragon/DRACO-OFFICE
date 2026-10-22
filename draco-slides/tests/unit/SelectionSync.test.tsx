import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";

const current = () =>
  within(screen.getByRole("navigation", { name: "Slides" }))
    .getAllByRole("button")
    .findIndex((b) => b.getAttribute("aria-current") === "true") + 1;

describe("selection stays synchronized", () => {
  afterEach(() => vi.restoreAllMocks());

  it("pane, status bar and ribbon agree after every kind of change", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    expect(screen.getByText("Slide 3 of 3")).toBeInTheDocument();
    expect(current()).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Slide 2 of 3")).toBeInTheDocument();
    expect(current()).toBe(2);

    const first = within(screen.getByRole("navigation", { name: "Slides" })).getAllByRole("button")[0];
    fireEvent.click(first);
    expect(screen.getByText("Slide 1 of 3")).toBeInTheDocument();
    expect(current()).toBe(1);

    fireEvent.keyDown(screen.getByRole("region", { name: "Slide editor" }), { key: "PageDown" });
    expect(current()).toBe(2);

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete slide" }));
    expect(screen.getByText("Slide 2 of 2")).toBeInTheDocument();
    expect(current()).toBe(2);
  });

  it("shows slide names under the thumbnails", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    expect(within(screen.getByRole("navigation", { name: "Slides" })).getByText("Slide 1")).toBeInTheDocument();
  });
});
