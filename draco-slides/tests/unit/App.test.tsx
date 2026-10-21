import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

describe("App", () => {
  it("opens the editor from home and adds a slide", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    expect(screen.getByText("Slide 1 of 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New slide" }));
    expect(screen.getByText("Slide 2 of 2")).toBeInTheDocument();
  });
});
