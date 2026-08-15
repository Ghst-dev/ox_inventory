/**
 * Transient UI state: what the tooltip is describing, and what the context menu is
 * open on. Both were Redux slices; neither needs anything a rune cannot do.
 */

import type { Inventory, SlotWithItem } from '../typings';

export const tooltip = $state<{
  item: SlotWithItem | null;
  inventoryType: Inventory['type'] | null;
  /**
   * The slot's rect at the moment the tooltip opened.
   *
   * The React build re-anchored to the cursor on every mousemove, so the tooltip slid
   * around while you were reading it. Anchoring to the slot instead holds it still —
   * the deliberate change here, and the reason this is a rect rather than a point.
   */
  anchor: DOMRect | null;
}>({ item: null, inventoryType: null, anchor: null });

export function openTooltip(item: SlotWithItem, inventoryType: Inventory['type'], anchor: DOMRect) {
  tooltip.item = item;
  tooltip.inventoryType = inventoryType;
  tooltip.anchor = anchor;
}

export function closeTooltip() {
  tooltip.item = null;
  tooltip.anchor = null;
}

export const contextMenu = $state<{ item: SlotWithItem | null; anchor: DOMRect | null }>({
  item: null,
  anchor: null,
});

/** Opened at the pointer, so the anchor is a zero-size rect at the click coordinates. */
export function openContextMenu(item: SlotWithItem, x: number, y: number) {
  contextMenu.item = item;
  contextMenu.anchor = new DOMRect(x, y, 0, 0);
}

export function closeContextMenu() {
  contextMenu.item = null;
  contextMenu.anchor = null;
}
