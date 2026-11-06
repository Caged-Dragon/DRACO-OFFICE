import { MIN_OBJECT_SIZE, type Rect } from "../geometry/rect";
import type { SlideObject } from "./types";

/**
 * Groups are flat: objects on a slide that share a `groupId`. There is one level only, and a group always has at
 * least two members (smaller groups are dissolved by `normalizeGroups`).
 */

export const rectOf = (o: Rect): Rect => ({ x: o.x, y: o.y, width: o.width, height: o.height });

/** Smallest rectangle containing all the given ones, or null for none. */
export function boundsOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Selecting any member of a group selects the whole group. Returns visible object ids in z-order. */
export function expandSelection(objects: SlideObject[], ids: Iterable<string>): string[] {
  const wanted = new Set(ids);
  const groups = new Set<string>();
  for (const o of objects) if (wanted.has(o.id) && o.groupId) groups.add(o.groupId);
  return objects.filter((o) => o.visible && (wanted.has(o.id) || (o.groupId !== null && groups.has(o.groupId)))).map((o) => o.id);
}

/** Dissolves groups with fewer than two members. */
export function normalizeGroups(objects: SlideObject[]): SlideObject[] {
  const counts = new Map<string, number>();
  for (const o of objects) if (o.groupId) counts.set(o.groupId, (counts.get(o.groupId) ?? 0) + 1);
  if (![...counts.values()].some((n) => n < 2)) return objects;
  return objects.map((o) => (o.groupId && (counts.get(o.groupId) ?? 0) < 2 ? { ...o, groupId: null } : o));
}

/**
 * Puts the given objects (at least two) into one new group. Objects leave any group they were in, and the members
 * become contiguous in the stacking order at the position of the topmost one, like PowerPoint.
 * Returns null when there is nothing to group.
 */
export function groupObjects(objects: SlideObject[], ids: Iterable<string>, groupId: string): SlideObject[] | null {
  const selected = new Set(ids);
  const members = objects.filter((o) => selected.has(o.id));
  if (members.length < 2) return null;
  const topIndex = Math.max(...members.map((m) => objects.indexOf(m)));
  const rest = objects.filter((o) => !selected.has(o.id));
  const before = objects.slice(0, topIndex + 1).filter((o) => !selected.has(o.id)).length;
  const grouped = members.map((m) => ({ ...m, groupId }));
  return normalizeGroups([...rest.slice(0, before), ...grouped, ...rest.slice(before)]);
}

/** Ungroups every group that any of the given objects belongs to (all of its members). */
export function ungroupObjects(objects: SlideObject[], ids: Iterable<string>): SlideObject[] {
  const selected = new Set(ids);
  const groups = new Set(objects.filter((o) => selected.has(o.id) && o.groupId).map((o) => o.groupId as string));
  if (groups.size === 0) return objects;
  return objects.map((o) => (o.groupId && groups.has(o.groupId) ? { ...o, groupId: null } : o));
}

/** True when the ids are exactly all the members of one group. */
export function isWholeGroup(objects: SlideObject[], ids: Iterable<string>): boolean {
  const selected = new Set(ids);
  const first = objects.find((o) => selected.has(o.id));
  if (!first?.groupId) return false;
  const members = objects.filter((o) => o.groupId === first.groupId);
  return members.length === selected.size && members.every((m) => selected.has(m.id));
}

/** Maps a rectangle from inside `from` to the same relative place inside `to` (used to resize several objects at once). */
export function scaleRect(r: Rect, from: Rect, to: Rect): Rect {
  const sx = from.width > 0 ? to.width / from.width : 1;
  const sy = from.height > 0 ? to.height / from.height : 1;
  return { x: to.x + (r.x - from.x) * sx, y: to.y + (r.y - from.y) * sy, width: r.width * sx, height: r.height * sy };
}

/** The smallest bounding width and height at which every member still has at least the minimum size. */
export function minBoundsSize(rects: Rect[], bounds: Rect, min = MIN_OBJECT_SIZE): { width: number; height: number } {
  return {
    width: Math.max(min, ...rects.map((r) => (r.width > 0 ? (min / r.width) * bounds.width : 0))),
    height: Math.max(min, ...rects.map((r) => (r.height > 0 ? (min / r.height) * bounds.height : 0))),
  };
}
