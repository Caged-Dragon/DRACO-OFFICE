import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import App from "../../src/App";
import { listPresentations } from "../../src/services/storage/presentationStore";

async function openEditor() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
}
const insertTextBox = () => {
  fireEvent.click(screen.getByRole("tab", { name: "Insert" }));
  fireEvent.click(screen.getByRole("button", { name: "Text box" }));
  fireEvent.click(screen.getByRole("tab", { name: "Home" }));
};
const canvas = () => screen.getByRole("group", { name: "Slide canvas" });
const box = () => within(canvas()).getByRole("img").querySelector<HTMLElement>(".slide__text--textbox")!;
const btn = (name: string) => screen.getByRole("button", { name });
const margin = (side: string) => screen.getByRole("spinbutton", { name: `Margin ${side}` });
const panelText = () => screen.getByRole("textbox", { name: "Text box 1" });
const status = () => screen.queryByText(/^Selected: /)?.textContent ?? null;
const setMargin = (side: string, value: string) => {
  fireEvent.change(margin(side), { target: { value } });
  fireEvent.blur(margin(side));
};

/**
 * jsdom does no layout, so simulate it: text objects are 300 x 100 px boxes whose content is one
 * 1.2 x font-size line per rt-line (offsetHeight and scrollHeight follow the font size and height style).
 */
function stubLayout() {
  const isText = (el: HTMLElement) => el.hasAttribute("data-text-id");
  const size = (el: HTMLElement) => parseFloat(el.style.fontSize) || 24;
  const content = (el: HTMLElement) => Math.ceil(el.querySelectorAll(".rt-line").length * size(el) * 1.2);
  const define = (name: string, get: (this: HTMLElement) => number) =>
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get });
  define("clientWidth", function () { return isText(this) ? 300 : 0; });
  define("clientHeight", function () { return isText(this) ? 100 : 0; });
  define("scrollWidth", function () { return isText(this) ? 300 : 0; });
  define("scrollHeight", function () { return isText(this) ? Math.max(100, content(this)) : 0; });
  define("offsetHeight", function () { return isText(this) ? (this.style.height === "auto" ? content(this) : 100) : 0; });
}
afterEach(() => {
  for (const name of ["clientWidth", "clientHeight", "scrollWidth", "scrollHeight", "offsetHeight"]) Reflect.deleteProperty(HTMLElement.prototype, name);
});

describe("text box layout controls", () => {
  it("are disabled until a text object is selected, then show its settings", async () => {
    await openEditor();
    for (const n of ["Align top", "Align middle", "Align bottom", "Clip overflow", "Shrink text to fit", "Resize box to fit text"]) {
      expect(btn(n), n).toBeDisabled();
    }
    for (const side of ["top", "right", "bottom", "left"]) expect(margin(side)).toBeDisabled();
    insertTextBox();
    expect(btn("Align top")).toHaveAttribute("aria-pressed", "true");
    expect(btn("Align middle")).toHaveAttribute("aria-pressed", "false");
    expect(btn("Clip overflow")).toHaveAttribute("aria-pressed", "true");
    for (const side of ["top", "right", "bottom", "left"]) expect(margin(side)).toHaveValue(0);
  });

  it("margins become padding on the canvas and the thumbnail, side by side", async () => {
    await openEditor();
    insertTextBox();
    setMargin("left", "20");
    expect(box().style.paddingLeft).toBe("20px");
    expect(box().style.paddingRight).toBe("");
    setMargin("top", "7.5");
    setMargin("right", "9");
    setMargin("bottom", "3");
    expect([box().style.paddingTop, box().style.paddingRight, box().style.paddingBottom, box().style.paddingLeft]).toEqual(["7.5px", "9px", "3px", "20px"]);
    const thumb = within(screen.getByRole("navigation", { name: "Slides" })).getAllByText("Text box")[0].closest<HTMLElement>(".slide__text")!;
    expect(thumb.style.paddingLeft).toBe("20px");
  });

  it("an indent adds to the left margin", async () => {
    await openEditor();
    insertTextBox();
    setMargin("left", "10");
    fireEvent.click(btn("Increase indent"));
    expect(box().style.paddingLeft).toBe("46px");
  });

  it("margins are clamped, and text that is not a number restores the value", async () => {
    await openEditor();
    insertTextBox();
    setMargin("top", "9999");
    expect(margin("top")).toHaveValue(200);
    expect(box().style.paddingTop).toBe("200px");
    setMargin("top", "-4");
    expect(margin("top")).toHaveValue(0);
    setMargin("left", "12");
    fireEvent.change(margin("left"), { target: { value: "" } });
    fireEvent.blur(margin("left"));
    expect(margin("left")).toHaveValue(12);
  });

  it("vertical alignment sets one class at a time; top is the plain default", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Align middle"));
    expect(box().classList.contains("rt-v--middle")).toBe(true);
    expect(btn("Align middle")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(btn("Align bottom"));
    expect(box().classList.contains("rt-v--bottom")).toBe(true);
    expect(box().classList.contains("rt-v--middle")).toBe(false);
    fireEvent.click(btn("Align top"));
    expect(box().className).not.toMatch(/rt-v--/);
    expect(btn("Align top")).toHaveAttribute("aria-pressed", "true");
  });

  it("Clip overflow toggles between clipping and showing spilled text", async () => {
    await openEditor();
    insertTextBox();
    expect(box().classList.contains("rt-overflow--visible")).toBe(false);
    fireEvent.click(btn("Clip overflow"));
    expect(box().classList.contains("rt-overflow--visible")).toBe(true);
    expect(btn("Clip overflow")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn("Clip overflow"));
    expect(box().classList.contains("rt-overflow--visible")).toBe(false);
  });

  it("while editing, box settings apply to the editor without replacing its text", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.doubleClick(screen.getByRole("button", { name: "Text box 1" }));
    const editor = screen.getByRole("textbox", { name: "Editing Text box 1" });
    const firstLine = editor.firstElementChild;
    fireEvent.click(btn("Align middle"));
    setMargin("left", "15");
    expect(editor.firstElementChild).toBe(firstLine);
    expect(editor.classList.contains("rt-v--middle")).toBe(true);
    expect(editor.style.paddingLeft).toBe("15px");
  });

  it("settings are autosaved", async () => {
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Align bottom"));
    setMargin("right", "11");
    fireEvent.click(btn("Clip overflow"));
    await waitFor(async () => {
      const list = await listPresentations();
      expect(list.some((p) => p.slides[0].objects.some((o) => o.role === "textbox" && o.verticalAlign === "bottom" && o.margins.right === 11 && o.overflow === "visible"))).toBe(true);
    });
  });
});

describe("overflow warning and fitting", () => {
  const fiveLines = () => fireEvent.change(panelText(), { target: { value: "1\n2\n3\n4\n5" } });

  it("warns when the text does not fit, and stops warning when it does", async () => {
    stubLayout();
    await openEditor();
    insertTextBox();
    expect(status()).toBe("Selected: Text box 1 (330, 230, 300 × 80)");
    fiveLines(); // 5 * 24 * 1.2 = 144 px in a 100 px box
    expect(status()).toBe("Selected: Text box 1 (330, 230, 300 × 80) – text overflows the box");
    expect(screen.getByRole("button", { name: "Text box 1" }).className).toContain("hit--overflow");
    fireEvent.change(panelText(), { target: { value: "1" } });
    expect(status()).toBe("Selected: Text box 1 (330, 230, 300 × 80)");
    expect(screen.getByRole("button", { name: "Text box 1" }).className).not.toContain("hit--overflow");
  });

  it("Shrink text to fit lowers the font size to the largest that fits", async () => {
    stubLayout();
    await openEditor();
    insertTextBox();
    fiveLines();
    fireEvent.click(btn("Shrink text to fit"));
    expect(box().style.fontSize).toBe("16.5px"); // 5 * 16.5 * 1.2 = 99 <= 100
    expect(screen.getByRole("spinbutton", { name: "Font size" })).toHaveValue(16.5);
    expect(status()).not.toContain("overflows");
  });

  it("Shrink text to fit leaves text that already fits alone and says so", async () => {
    stubLayout();
    await openEditor();
    insertTextBox();
    fireEvent.click(btn("Shrink text to fit"));
    expect(box().style.fontSize).toBe("24px");
    expect(await screen.findByText("The text already fits.")).toBeInTheDocument();
  });

  it("Shrink text to fit explains when even the smallest size is too big", async () => {
    stubLayout();
    await openEditor();
    insertTextBox();
    fireEvent.change(panelText(), { target: { value: Array.from({ length: 40 }, (_, i) => i).join("\n") } });
    fireEvent.click(btn("Shrink text to fit"));
    expect(box().style.fontSize).toBe("6px");
    expect(await screen.findByText(/does not fit at the smallest size/)).toBeInTheDocument();
  });

  it("Resize box to fit text sets the height to hold the text", async () => {
    stubLayout();
    await openEditor();
    insertTextBox();
    fiveLines();
    fireEvent.click(btn("Resize box to fit text"));
    expect(status()).toBe("Selected: Text box 1 (330, 230, 300 × 144)");
  });

  it("without layout (hidden slide, test environment) nothing changes and the user is told", async () => {
    await openEditor();
    insertTextBox();
    fiveLines();
    fireEvent.click(btn("Shrink text to fit"));
    expect(await screen.findByText(/Fitting needs the slide to be shown on screen/)).toBeInTheDocument();
    expect(box().style.fontSize).toBe("24px");
    expect(status()).toBe("Selected: Text box 1 (330, 230, 300 × 80)");
  });

  it("the text box group has no accessibility violations", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Body" }), { button: 0, clientX: 1, clientY: 1 });
    fireEvent.mouseUp(window);
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 100)).join(" | ")}`)).toEqual([]);
  });
});
