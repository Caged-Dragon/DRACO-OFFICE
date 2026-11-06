import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberField } from "../../src/components/common/NumberField";

const setup = (props: Partial<Parameters<typeof NumberField>[0]> = {}) => {
  const onCommit = vi.fn();
  render(<NumberField label="Amount" short="A" value={10} min={0} max={100} onCommit={onCommit} {...props} />);
  const input = screen.getByRole("spinbutton", { name: "Amount" }) as HTMLInputElement;
  const enter = (text: string) => {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.blur(input);
  };
  return { input, onCommit, enter };
};

describe("NumberField", () => {
  it("shows the value and commits a changed value on blur", () => {
    const { input, onCommit, enter } = setup();
    expect(input).toHaveValue(10);
    enter("42");
    expect(onCommit).toHaveBeenCalledWith(42);
  });

  it("does not commit an unchanged value", () => {
    const { onCommit, enter } = setup();
    enter("10");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("clamps to the range and shows the clamped value", () => {
    const { input, onCommit, enter } = setup();
    enter("999");
    expect(onCommit).toHaveBeenLastCalledWith(100);
    expect(input).toHaveValue(100);
    enter("-5");
    expect(onCommit).toHaveBeenLastCalledWith(0);
    expect(input).toHaveValue(0);
  });

  it("restores the value for empty or non-numeric text", () => {
    const { input, onCommit, enter } = setup();
    enter("");
    expect(input).toHaveValue(10);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("rounds to the given decimals before clamping", () => {
    const { input, onCommit, enter } = setup({ decimals: 1 });
    enter("12.345");
    expect(onCommit).toHaveBeenLastCalledWith(12.3);
    expect(input).toHaveValue(12.3);
  });

  it("rounds first and then clamps", () => {
    const { onCommit, enter } = setup({ decimals: 0, max: 50 });
    enter("99.6");
    expect(onCommit).toHaveBeenLastCalledWith(50);
  });

  it("Enter commits (by leaving the field)", () => {
    const { input, onCommit } = setup();
    input.focus();
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith(7);
  });

  it("can be disabled and hides its caption from assistive technology", () => {
    setup({ disabled: true });
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toBeDisabled();
    expect(screen.getByText("A")).toHaveAttribute("aria-hidden", "true");
  });
});
