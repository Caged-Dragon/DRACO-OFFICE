import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MenuButton } from "../../src/components/menus/MenuButton";

describe("MenuButton", () => {
  const setup = () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <MenuButton
        label="File"
        items={[
          { label: "One", onSelect: a },
          { label: "Two", onSelect: b },
        ]}
      />,
    );
    return { a, b };
  };

  it("opens, focuses the first item, and runs the selected item", () => {
    const { b } = setup();
    const button = screen.getByRole("button", { name: "File" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "One" })).toHaveFocus();
    fireEvent.click(screen.getByRole("menuitem", { name: "Two" }));
    expect(b).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("supports arrow keys and Escape returns focus to the button", () => {
    setup();
    const button = screen.getByRole("button", { name: "File" });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Two" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "One" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});
