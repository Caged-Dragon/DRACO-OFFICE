import { fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import App from "../../src/App";
import { SETTINGS_KEY } from "../../src/services/settings/settingsStore";

async function openEditor() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
}
const tab = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));
const insertTextBox = () => {
  tab("Insert");
  fireEvent.click(screen.getByRole("button", { name: "Text box" }));
  tab("Home");
};
const actualSize = () => {
  tab("View");
  fireEvent.click(screen.getByRole("button", { name: "Actual size" }));
  tab("Home");
};
const toggle = (name: string) => {
  tab("View");
  fireEvent.click(screen.getByRole("button", { name }));
  tab("Home");
};
const canvas = () => screen.getByRole("group", { name: "Slide canvas" });
const status = () => screen.queryByText(/^Selected: /)?.textContent ?? null;
const box = () => screen.getByRole("button", { name: "Text box 1" });
const stored = () => JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
const drag = (el: HTMLElement, from: [number, number], to: [number, number], mods: Record<string, boolean> = {}, release = true) => {
  fireEvent.mouseDown(el, { button: 0, clientX: from[0], clientY: from[1] });
  fireEvent.mouseMove(window, { clientX: to[0], clientY: to[1], ...mods });
  if (release) fireEvent.mouseUp(window);
};

afterEach(() => localStorage.clear());

describe("rulers", () => {
  it("View > Rulers shows and hides both rulers, and remembers the choice", async () => {
    await openEditor();
    tab("View");
    const button = screen.getByRole("button", { name: "Rulers" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("ruler-horizontal")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    const h = screen.getByTestId("ruler-horizontal");
    expect(screen.getByTestId("ruler-vertical")).toBeInTheDocument();
    expect(within(h as unknown as HTMLElement).getByText("0")).toBeInTheDocument();
    expect(stored().showRulers).toBe(true);
    fireEvent.click(button);
    expect(screen.queryByTestId("ruler-horizontal")).not.toBeInTheDocument();
    expect(stored().showRulers).toBe(false);
  });

  it("highlights the selected object on the rulers", async () => {
    await openEditor();
    toggle("Rulers");
    insertTextBox();
    const band = screen.getByTestId("ruler-horizontal").querySelector(".ruler__selection")!;
    expect(band).not.toBeNull();
    fireEvent.mouseDown(canvas(), { button: 0, clientX: 5, clientY: 5 });
    expect(screen.getByTestId("ruler-horizontal").querySelector(".ruler__selection")).toBeNull();
  });
});

describe("gridlines", () => {
  it("View > Gridlines shows a grid sized to the zoom, and hides it when it would be too dense", async () => {
    await openEditor(); // fitted: 20 px grid at about 0.77 zoom is about 15 screen px
    expect(screen.queryByTestId("grid")).not.toBeInTheDocument();
    toggle("Gridlines");
    expect(screen.getByTestId("grid")).toBeInTheDocument();
    expect(parseFloat(screen.getByTestId("grid").style.backgroundSize)).toBeCloseTo(15.33, 1);
    tab("View");
    fireEvent.change(screen.getByRole("combobox", { name: "Grid size" }), { target: { value: "5" } }); // 3.8 px: too dense
    expect(screen.queryByTestId("grid")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Grid size" }), { target: { value: "100" } });
    expect(parseFloat(screen.getByTestId("grid").style.backgroundSize)).toBeCloseTo(76.67, 1);
    expect(stored()).toMatchObject({ showGrid: true, gridSize: 100 });
  });
});

describe("snapping while dragging", () => {
  it("an edge snaps to other objects, with guides shown during the drag only", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(box(), [400, 300], [153, 300], {}, false); // left edge 83 is 3 px from the placeholders' left edge at 80
    expect(status()).toBe("Selected: Text box 1 (80, 230, 300 × 80)");
    const vertical = screen.getAllByTestId("guide-v");
    expect(vertical.some((g) => g.style.left === "80px")).toBe(true);
    expect(screen.getAllByTestId("guide-h").length).toBeGreaterThan(0); // vertically centered on the slide: 270
    fireEvent.mouseUp(window);
    expect(screen.queryAllByTestId("guide-v")).toHaveLength(0);
    expect(screen.queryAllByTestId("guide-h")).toHaveLength(0);
    expect(status()).toBe("Selected: Text box 1 (80, 230, 300 × 80)");
  });

  it("Alt turns snapping off for that drag", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(box(), [400, 300], [153, 300], { altKey: true });
    expect(status()).toBe("Selected: Text box 1 (83, 230, 300 × 80)");
  });

  it("Snap to objects can be switched off", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    toggle("Snap to objects");
    expect(stored().snapToObjects).toBe(false);
    drag(box(), [400, 300], [153, 300]);
    expect(status()).toBe("Selected: Text box 1 (83, 230, 300 × 80)");
  });

  it("the snap distance is constant on screen, so it is larger in slide pixels when zoomed out", async () => {
    await openEditor(); // fitted: 1 screen px = 1.3 slide px, so about 7.8 px reach
    insertTextBox();
    drag(box(), [400, 300], [214, 300]); // 186 screen px = 242.6 slide px: left edge 87.4, 7.4 px from 80
    expect(status()).toBe("Selected: Text box 1 (80, 230, 300 × 80)");
  });

  it("at 100% the same 7 px distance is too far to snap", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(box(), [400, 300], [157, 300]); // left edge 87
    expect(status()).toBe("Selected: Text box 1 (87, 230, 300 × 80)");
  });

  it("Snap to grid snaps the top-left corner to the nearest gridline", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    toggle("Snap to objects");
    toggle("Snap to grid");
    drag(box(), [400, 300], [392, 300]); // left edge 322 -> 320; top 230 is 10 px from 240, too far
    expect(status()).toBe("Selected: Text box 1 (320, 230, 300 × 80)");
  });

  it("resizing snaps the moving edge", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(screen.getByTestId("handle-e"), [630, 270], [877, 270]); // right edge 877 -> 880 (the placeholders' right edge)
    expect(status()).toBe("Selected: Text box 1 (330, 230, 550 × 80)");
  });

  it("resizing with locked proportions is not snapped", async () => {
    await openEditor();
    insertTextBox();
    actualSize();
    drag(screen.getByTestId("handle-se"), [630, 310], [877, 310], { shiftKey: true });
    expect(status()).toBe("Selected: Text box 1 (330, 230, 547 × 146)");
  });

  it("keyboard nudging is never snapped", async () => {
    await openEditor();
    insertTextBox();
    for (let i = 0; i < 5; i++) fireEvent.keyDown(canvas(), { key: "ArrowLeft", ctrlKey: true });
    expect(status()).toBe("Selected: Text box 1 (325, 230, 300 × 80)");
  });
});

describe("settings dialog", () => {
  it("has the editing aids, and saves them", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    const dialog = within(screen.getByRole("dialog", { name: "Settings" }));
    fireEvent.click(dialog.getByLabelText("Show rulers"));
    fireEvent.click(dialog.getByLabelText("Show gridlines"));
    fireEvent.click(dialog.getByLabelText("Snap objects to the grid"));
    fireEvent.click(dialog.getByLabelText("Snap objects to other objects and the slide edges"));
    fireEvent.change(dialog.getByLabelText("Grid size"), { target: { value: "50" } });
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));
    expect(stored()).toMatchObject({ showRulers: true, showGrid: true, snapToGrid: true, snapToObjects: false, gridSize: 50 });
  });

  it("saved rulers and gridlines appear when a presentation opens", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showRulers: true, showGrid: true, gridSize: 100 }));
    await openEditor();
    expect(screen.getByTestId("ruler-horizontal")).toBeInTheDocument();
    expect(screen.getByTestId("grid")).toBeInTheDocument();
  });

  it("with rulers and gridlines on there are no accessibility violations", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showRulers: true, showGrid: true }));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    tab("View");
    const result = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 100)).join(" | ")}`)).toEqual([]);
  });
});
