/**
 * Keyboard navigation for toolbar rows (WAI-ARIA toolbar pattern):
 * Left/Right move between controls (wrapping), Home/End jump to the ends.
 *
 * Returns the index to focus next, or null when the key isn't a navigation
 * key or the current control should keep its own arrow-key behavior.
 */
export function nextToolbarIndex(
  key: string,
  current: number,
  count: number,
  orientation: "horizontal" | "vertical" = "horizontal"
): number | null {
  if (count <= 0 || current < 0 || current >= count) return null;
  const forwardKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
  const backwardKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
  switch (key) {
    case forwardKey:
      return (current + 1) % count;
    case backwardKey:
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * Controls that own the arrow keys themselves (moving the caret in a text
 * field, changing the option in a select) must not be hijacked, or the user
 * could no longer edit text in them.
 */
export function ownsArrowKeys(el: { tagName: string; type?: string }): boolean {
  const tag = el.tagName.toUpperCase();
  if (tag === "SELECT" || tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = (el.type ?? "text").toLowerCase();
    return !["checkbox", "radio", "button", "submit", "file"].includes(type);
  }
  return false;
}
