import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

describe("App shell", () => {
  it("opens the editor from home and adds a slide", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    expect(screen.getByText("Slide 1 of 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    expect(screen.getByText("Slide 2 of 2")).toBeInTheDocument();
  });

  it("disables the Editor nav item until a presentation is open", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Editor" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps edits when navigating Home and back to the Editor", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(await screen.findByRole("heading", { name: "Your presentations" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editor" }));
    expect(screen.getByText("Slide 2 of 2")).toBeVisible();
  });
});
