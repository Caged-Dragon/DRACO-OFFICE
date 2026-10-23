import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

describe("slide change announcements", () => {
  it("announces the selected slide to screen readers, but not on first load", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    expect(screen.queryByText(/^Slide \d+ of \d+: /)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    expect(screen.getByText("Slide 2 of 2: Slide 2")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("region", { name: "Slide editor" }), { key: "PageUp" });
    expect(screen.getByText("Slide 1 of 2: Slide 1")).toBeInTheDocument();
  });

  it("does not announce when slides are only reordered", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Move up" }));
    expect(screen.getByText("Slide 2 of 2: Slide 2")).toBeInTheDocument(); // still the earlier announcement
  });
});
