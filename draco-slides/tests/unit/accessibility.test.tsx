import { fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

/**
 * Automated accessibility baseline using axe-core. jsdom has no layout, so the colour-contrast rule is
 * off here; contrast is covered by tests/unit/contrast.test.ts. Automated checks find only part of the
 * real problems, so manual keyboard and screen-reader testing is still needed (Version 95).
 */
async function violations(container: HTMLElement): Promise<string[]> {
  const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 120)).join(" | ")}`);
}

describe("accessibility baseline (axe-core)", () => {
  it("Home has no violations", async () => {
    const { container } = render(<App />);
    await screen.findByRole("heading", { name: "Your presentations" });
    expect(await violations(container)).toEqual([]);
  });

  it("the editor (Home tab) has no violations", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    expect(await violations(container)).toEqual([]);
  });

  it("the editor (View tab) has no violations", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.click(screen.getByRole("tab", { name: "View" }));
    expect(await violations(container)).toEqual([]);
  });

  it("the Settings dialog has no violations", async () => {
    const { container } = render(<App />);
    await screen.findByRole("heading", { name: "Your presentations" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await violations(container)).toEqual([]);
  });

  it("the File menu and Properties dialog have no violations", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    expect(await violations(container)).toEqual([]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Properties" }));
    expect(await violations(container)).toEqual([]);
  });

  it("the editor with a selected text box (handles shown) has no violations", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.click(screen.getByRole("tab", { name: "Insert" }));
    fireEvent.click(screen.getByRole("button", { name: "Text box" }));
    expect(await violations(container)).toEqual([]);
  });
});
