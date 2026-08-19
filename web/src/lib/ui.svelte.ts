/**
 * Transient UI state: whether the inventory is on screen, what the tooltip is describing,
 * and what the context menu is open on. The latter two were Redux slices; neither needs
 * anything a rune cannot do.
 */

import type { Inventory, SlotWithItem } from '../typings';

/**
 * Whether the two panes are on screen.
 *
 * This lived as local state inside Inventory.svelte until the hotbar needed it. A
 * persistent hotbar has to stand down while the inventory is open — it sits at the
 * bottom of the same viewport and would draw a second copy of slots 1-5 underneath the
 * pane that already shows them. Duplicating the four NUI listeners in a second component
 * would leave two answers to one question, so the answer moved here instead.
 */
export const ui = $state<{ inventoryOpen: boolean }>({ inventoryOpen: false });

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

/**
 * The split prompt: "how many of these do you want to move?"
 *
 * Opened by releasing a drag with Alt held. The alternatives already in the UI are the
 * amount box, which has to be filled in *before* the drag and applies to every move
 * until you clear it, and shift-drag, which only ever gives you half — so moving 7 of a
 * stack of 40 meant typing 7, dragging, then remembering to clear the box.
 *
 * `commit` is supplied by whoever opened the prompt rather than resolved here. The rules
 * for what a drop means differ per pane (a shop purchase is not a move, and a crafting
 * bench counts iterations rather than items), and all three already live in actions.ts.
 * Storing the closure keeps that knowledge out of this file.
 */
export const splitPrompt = $state<{
  anchor: DOMRect | null;
  label: string;
  max: number;
  commit: ((count: number) => void) | null;
}>({ anchor: null, label: '', max: 0, commit: null });

export function openSplitPrompt(
  label: string,
  max: number,
  x: number,
  y: number,
  commit: (count: number) => void,
) {
  splitPrompt.label = label;
  splitPrompt.max = max;
  splitPrompt.anchor = new DOMRect(x, y, 0, 0);
  splitPrompt.commit = commit;
}

export function closeSplitPrompt() {
  splitPrompt.anchor = null;
  splitPrompt.commit = null;
}

/**
 * The weapon whose attachments are being looked at, by slot in the player's inventory.
 *
 * A slot number rather than the item, deliberately. Removing a component is answered by
 * Lua with a bare acknowledgement and the real change arrives later as refreshSlots, so
 * the panel has to read live from the store to see a part leave. Holding the item itself
 * would be holding a copy made before the removal.
 */
export const weaponPanel = $state<{ slot: number | null }>({ slot: null });

export function openWeaponPanel(slot: number) {
  weaponPanel.slot = slot;
}

export function closeWeaponPanel() {
  weaponPanel.slot = null;
}
