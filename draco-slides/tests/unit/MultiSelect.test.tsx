import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { listPresentations } from "../../src/services/storage/presentationStore";

const LOCKED_MESSAGE = "Locked objects can't be moved, resized or deleted. Unlock them first.";

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
const canvas = () => screen.getByRole("group", { name: "Slide canvas" });
const hit = (name: string) => screen.getByRole("button", { name });
const btn = (name: string) => screen.getByRole("button", { name });
const status = () => screen.queryByText(/^Selected: /)?.textContent ?? null;
/** A click: mouse down and up without moving. */
const press = (el: HTMLElement, mods: Record<string, boolean> = {}) => {
  fireEvent.mouseDown(el, { button: 0, clientX: 1, clientY: 1, ...mods });
  fireEvent.mouseUp(window, { clientX: 1, clientY: 1 });
};
const clearSelection = () => press(canvas());
const selectBoth = () => {
  press(hit("Title"));
  press(hit("Body"), { shiftKey: true });
};
const key = (k: string, mods: Record<string, boolean> = {}) => fireEvent.keyDown(canvas(), { key: k, ...mods });
const drag = (el: HTMLElement, by: [number, number]) => {
  fireEvent.mouseDown(el, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.mouseMove(window, { clientX: 100 + by[0], clientY: 100 + by[1] });
  fireEvent.mouseUp(window, { clientX: 100 + by[0], clientY: 100 + by[1] });
};
const BOTH = "Selected: 2 objects (80, 60, 800 × 400)";
const GROUP = "Selected: group of 2 objects (80, 60, 800 × 400)";

describe("selecting several objects", () => {
  it("Shift+click adds and removes objects; the label and bounding box describe the selection", async () => {
    await openEditor();
    press(hit("Title"));
    expect(status()).toBe("Selected: Title (80, 60, 800 × 100)");
    press(hit("Body"), { shiftKey: true });
    expect(status()).toBe(BOTH);
    expect(screen.getByTestId("selection-box")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^handle-/)).toHaveLength(8);
    expect(hit("Title")).toHaveAttribute("aria-pressed", "true");
    expect(hit("Body")).toHaveAttribute("aria-pressed", "true");
    press(hit("Title"), { ctrlKey: true });
    expect(status()).toBe("Selected: Body (80, 200, 800 × 260)");
    expect(screen.queryByTestId("selection-box")).not.toBeInTheDocument();
  });

  it("is announced to screen readers", async () => {
    await openEditor();
    selectBoth();
    expect(screen.getByText("2 objects selected")).toBeInTheDocument();
  });

  it("single-object commands switch off while several objects are selected", async () => {
    await openEditor();
    selectBoth();
    expect(btn("Edit text")).toBeDisabled();
    expect(btn("Bold")).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "X position" })).toBeDisabled();
    expect(btn("Delete object")).toBeEnabled();
    expect(btn("Lock")).toBeEnabled();
  });

  it("Ctrl+A and the Select all button select every object", async () => {
    await openEditor();
    canvas().focus();
    key("a", { ctrlKey: true });
    expect(status()).toBe(BOTH);
    clearSelection();
    expect(status()).toBeNull();
    fireEvent.click(btn("Select all"));
    expect(status()).toBe(BOTH);
  });

  it("Escape clears a multiple selection", async () => {
    await openEditor();
    selectBoth();
    key("Escape");
    expect(status()).toBeNull();
  });
});

describe("rubber-band selection", () => {
  it("dragging on empty canvas selects the objects the rectangle completely encloses", async () => {
    await openEditor();
    actualSize(); // the viewport shows slide x 80 to 880 and y 20 to 520
    fireEvent.mouseDown(canvas(), { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 800, clientY: 500 });
    const m = screen.getByTestId("marquee");
    expect([m.style.left, m.style.top, m.style.width, m.style.height]).toEqual(["80px", "20px", "800px", "500px"]);
    fireEvent.mouseUp(window, { clientX: 800, clientY: 500 });
    expect(screen.queryByTestId("marquee")).not.toBeInTheDocument();
    expect(status()).toBe(BOTH);
  });

  it("does not select objects that are only partly inside", async () => {
    await openEditor();
    actualSize();
    fireEvent.mouseDown(canvas(), { button: 0, clientX: 0, clientY: 30 });
    fireEvent.mouseMove(window, { clientX: 800, clientY: 200 }); // slide y 50 to 220: the title fits, the body does not
    fireEvent.mouseUp(window, { clientX: 800, clientY: 200 });
    expect(status()).toBe("Selected: Title (80, 60, 800 × 100)");
  });

  it("Shift+drag adds to the current selection", async () => {
    await openEditor();
    actualSize();
    press(hit("Body"));
    fireEvent.mouseDown(canvas(), { button: 0, clientX: 0, clientY: 30, shiftKey: true });
    fireEvent.mouseMove(window, { clientX: 800, clientY: 200 });
    fireEvent.mouseUp(window, { clientX: 800, clientY: 200 });
    expect(status()).toBe(BOTH);
  });

  it("a plain click on empty canvas only clears the selection", async () => {
    await openEditor();
    selectBoth();
    clearSelection();
    expect(status()).toBeNull();
    expect(screen.queryByTestId("marquee")).not.toBeInTheDocument();
  });
});

describe("moving and resizing several objects", () => {
  it("dragging one selected object moves the whole selection together", async () => {
    await openEditor();
    actualSize();
    selectBoth();
    drag(hit("Title"), [50, 40]);
    expect(status()).toBe("Selected: 2 objects (130, 100, 800 × 400)");
    press(hit("Body"));
    expect(status()).toBe("Selected: Body (130, 240, 800 × 260)"); // moved by the same amount as the title
  });

  it("a plain click on a selected object narrows the selection to it", async () => {
    await openEditor();
    selectBoth();
    press(hit("Body"));
    expect(status()).toBe("Selected: Body (80, 200, 800 × 260)");
    expect(btn("Edit text")).toBeEnabled();
  });

  it("the whole selection is kept on the slide as one", async () => {
    await openEditor();
    actualSize();
    selectBoth();
    drag(hit("Title"), [5000, 0]);
    expect(status()).toBe("Selected: 2 objects (940, 60, 800 × 400)");
  });

  it("a corner handle scales all selected objects together", async () => {
    await openEditor();
    actualSize();
    selectBoth();
    drag(screen.getByTestId("handle-se"), [80, 40]); // the bounds grow from 800 x 400 to 880 x 440
    expect(status()).toBe("Selected: 2 objects (80, 60, 880 × 440)");
    press(hit("Body"));
    expect(status()).toBe("Selected: Body (80, 214, 880 × 286)");
  });

  it("arrow keys move and Shift+arrows resize the selection", async () => {
    await openEditor();
    selectBoth();
    key("ArrowRight");
    expect(status()).toBe("Selected: 2 objects (90, 60, 800 × 400)");
    key("ArrowLeft", { ctrlKey: true });
    expect(status()).toBe("Selected: 2 objects (89, 60, 800 × 400)");
    key("ArrowRight", { shiftKey: true });
    expect(status()).toBe("Selected: 2 objects (89, 60, 810 × 400)");
    press(hit("Title"));
    expect(status()).toBe("Selected: Title (89, 60, 810 × 100)");
  });

  it("Delete removes all selected objects", async () => {
    await openEditor();
    selectBoth();
    key("Delete");
    expect(screen.queryByRole("button", { name: "Title" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Body" })).not.toBeInTheDocument();
    expect(status()).toBeNull();
  });
});

describe("groups", () => {
  it("Group joins the selection, Ungroup splits it, and the buttons follow the state", async () => {
    await openEditor();
    selectBoth();
    expect(btn("Group")).toBeEnabled();
    expect(btn("Ungroup")).toBeDisabled();
    fireEvent.click(btn("Group"));
    expect(status()).toBe(GROUP);
    expect(btn("Group")).toBeDisabled();
    expect(btn("Ungroup")).toBeEnabled();
    fireEvent.click(btn("Ungroup"));
    expect(status()).toBe(BOTH);
    expect(btn("Group")).toBeEnabled();
    expect(btn("Ungroup")).toBeDisabled();
  });

  it("clicking one member of a group selects the whole group", async () => {
    await openEditor();
    selectBoth();
    fireEvent.click(btn("Group"));
    clearSelection();
    press(hit("Body"));
    expect(status()).toBe(GROUP);
  });

  it("clicking a selected group's member again drills into it; only that member then moves", async () => {
    await openEditor();
    actualSize();
    selectBoth();
    fireEvent.click(btn("Group"));
    press(hit("Title"));
    expect(status()).toBe("Selected: Title (80, 60, 800 × 100) – in a group");
    drag(hit("Title"), [30, 0]);
    expect(status()).toBe("Selected: Title (110, 60, 800 × 100) – in a group");
    press(hit("Body"));
    expect(status()).toMatch(/^Selected: group of 2 objects /); // the group is selected again; Body did not move
    fireEvent.click(btn("Ungroup"));
    press(hit("Body"));
    expect(status()).toBe("Selected: Body (80, 200, 800 × 260)");
  });

  it("a member of a group can still be edited in place", async () => {
    await openEditor();
    selectBoth();
    fireEvent.click(btn("Group"));
    fireEvent.doubleClick(hit("Title"));
    expect(screen.getByRole("textbox", { name: "Editing Title" })).toBeInTheDocument();
    expect(status()).toBe("Selected: Title (80, 60, 800 × 100) – editing text – in a group");
  });

  it("Ctrl+G groups and Ctrl+Shift+G ungroups", async () => {
    await openEditor();
    selectBoth();
    canvas().focus();
    key("g", { ctrlKey: true });
    expect(status()).toBe(GROUP);
    key("G", { ctrlKey: true, shiftKey: true });
    expect(status()).toBe(BOTH);
  });

  it("Delete removes a whole selected group", async () => {
    await openEditor();
    selectBoth();
    fireEvent.click(btn("Group"));
    key("Delete");
    expect(screen.queryByRole("button", { name: "Title" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Body" })).not.toBeInTheDocument();
  });

  it("deleting one member of a pair leaves the other ungrouped", async () => {
    await openEditor();
    selectBoth();
    fireEvent.click(btn("Group"));
    press(hit("Title")); // drill in
    key("Delete");
    press(hit("Body"));
    expect(status()).toBe("Selected: Body (80, 200, 800 × 260)"); // no "in a group"
  });

  it("Tab treats a group as one stop", async () => {
    await openEditor();
    insertTextBox();
    selectBoth();
    fireEvent.click(btn("Group"));
    clearSelection();
    key("Tab");
    expect(status()).toBe(GROUP);
    key("Tab");
    expect(status()).toMatch(/^Selected: Text box 1 /);
    key("Tab");
    expect(status()).toBeNull();
  });
});

describe("locking", () => {
  it("Lock locks the selection, hides the handles, disables the position fields and shows the state", async () => {
    await openEditor();
    press(hit("Title"));
    expect(btn("Lock")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn("Lock"));
    expect(btn("Lock")).toHaveAttribute("aria-pressed", "true");
    expect(status()).toBe("Selected: Title (80, 60, 800 × 100) – locked");
    expect(screen.queryAllByTestId(/^handle-/)).toHaveLength(0);
    expect(screen.getByRole("spinbutton", { name: "X position" })).toBeDisabled();
    fireEvent.click(btn("Lock"));
    expect(btn("Lock")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByTestId(/^handle-/)).toHaveLength(8);
  });

  it("a locked object cannot be dragged, nudged or deleted, and the user is told why", async () => {
    await openEditor();
    actualSize();
    press(hit("Title"));
    fireEvent.click(btn("Lock"));
    drag(hit("Title"), [50, 40]);
    expect(await screen.findAllByText(LOCKED_MESSAGE)).not.toHaveLength(0);
    expect(status()).toBe("Selected: Title (80, 60, 800 × 100) – locked");
    key("ArrowRight");
    key("Delete");
    fireEvent.click(btn("Delete object"));
    expect(status()).toBe("Selected: Title (80, 60, 800 × 100) – locked");
    expect(hit("Title")).toBeInTheDocument();
  });

  it("a plain click on a locked object just selects it, without a warning", async () => {
    await openEditor();
    press(hit("Title"));
    fireEvent.click(btn("Lock"));
    clearSelection();
    press(hit("Title"));
    expect(status()).toBe("Selected: Title (80, 60, 800 × 100) – locked");
    expect(screen.queryByText(LOCKED_MESSAGE)).not.toBeInTheDocument();
  });

  it("text and formatting of a locked object can still be edited", async () => {
    await openEditor();
    press(hit("Title"));
    fireEvent.click(btn("Lock"));
    fireEvent.click(btn("Italic"));
    const title = within(within(canvas()).getByRole("img") as HTMLElement).getByText("Untitled presentation").closest<HTMLElement>(".slide__text")!;
    expect(title.style.fontStyle).toBe("italic");
    fireEvent.doubleClick(hit("Title"));
    expect(screen.getByRole("textbox", { name: "Editing Title" })).toBeInTheDocument();
  });

  it("with a mix of locked and unlocked objects nothing moves; Lock then locks everything", async () => {
    await openEditor();
    actualSize();
    press(hit("Title"));
    fireEvent.click(btn("Lock"));
    press(hit("Body"), { shiftKey: true });
    expect(btn("Lock")).toHaveAttribute("aria-pressed", "false");
    drag(hit("Body"), [50, 0]);
    expect(await screen.findAllByText(LOCKED_MESSAGE)).not.toHaveLength(0);
    expect(status()).toBe(`${BOTH} – locked`);
    fireEvent.click(btn("Lock"));
    expect(btn("Lock")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(btn("Lock"));
    expect(btn("Lock")).toHaveAttribute("aria-pressed", "false");
    drag(hit("Body"), [50, 0]);
    expect(status()).toBe("Selected: 2 objects (130, 60, 800 × 400)");
  });

  it("locked objects can still be selected by rubber band", async () => {
    await openEditor();
    actualSize();
    selectBoth();
    fireEvent.click(btn("Lock"));
    clearSelection();
    fireEvent.mouseDown(canvas(), { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 800, clientY: 500 });
    fireEvent.mouseUp(window, { clientX: 800, clientY: 500 });
    expect(status()).toBe(`${BOTH} – locked`);
  });
});

describe("persistence and accessibility", () => {
  it("groups and locks are autosaved", async () => {
    await openEditor();
    selectBoth();
    fireEvent.click(btn("Group"));
    fireEvent.click(btn("Lock"));
    await waitFor(async () => {
      const list = await listPresentations();
      const objs = list.flatMap((p) => p.slides[0].objects).filter((o) => o.groupId !== null && o.locked);
      expect(objs.length).toBeGreaterThanOrEqual(2);
      expect(new Set(objs.map((o) => o.groupId)).size).toBe(1);
    });
  });

  it("the selection, group and lock controls have no accessibility violations", async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New presentation" }));
    selectBoth();
    fireEvent.click(btn("Group"));
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 100)).join(" | ")}`)).toEqual([]);
  });
});
