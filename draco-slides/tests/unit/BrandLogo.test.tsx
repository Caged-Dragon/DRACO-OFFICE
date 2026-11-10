import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

describe("logo in the app", () => {
  it("shows the logo in the top bar and on Home, as a decorative image next to the product name", async () => {
    const { container } = render(<App />);
    await screen.findByRole("heading", { name: "Your presentations" });
    const brandLogo = container.querySelector<HTMLImageElement>(".brand img.brand__logo");
    expect(brandLogo).not.toBeNull();
    expect(brandLogo!.getAttribute("alt")).toBe(""); // the product name is the text beside it
    expect(brandLogo!.getAttribute("src")).toMatch(/logo/);
    expect(brandLogo!.width).toBe(28);
    expect(screen.getByText("Draco Slides")).toBeInTheDocument();
    const homeLogo = container.querySelector<HTMLImageElement>("img.home__logo");
    expect(homeLogo).not.toBeNull();
    expect(homeLogo!.getAttribute("alt")).toBe("");
    expect(homeLogo!.width).toBe(64);
  });
});
