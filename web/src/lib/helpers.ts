/**
 * Pure inventory logic, ported from the React build's helpers/index.ts.
 *
 * These decide what a player is allowed to do with a slot — whether an item can be
 * bought, crafted, stacked, or where it would land. Getting any of them subtly wrong
 * shows up as an item that cannot be picked up rather than as an error, so they are
 * carried over as literally as the change of state container allows.
 *
 * The one deliberate change is `isEqual`: lodash-es was pulled in for that single
 * function and nothing else.
 */

import type { Inventory, ItemData, Slot, SlotWithItem, State } from '../typings';
import { InventoryType } from '../typings';
import { fetchNui } from './nui';
import { items as itemDefs, imagePath } from './state.svelte';

/**
 * Deep equality for item metadata, replacing lodash's isEqual.
 *
 * Metadata comes from Lua as decoded JSON, so the value space is exactly what
 * json.decode produces: nulls, booleans, numbers, strings, arrays and plain objects.
 * There are no Dates, Maps, Sets or class instances to handle, which is what makes a
 * function this short sufficient — do not reuse it as a general-purpose deep equal.
 */
export function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;

  if (aIsArray) {
    const x = a as unknown[];
    const y = b as unknown[];
    return x.length === y.length && x.every((value, i) => isEqual(value, y[i]));
  }

  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(x);

  // Key order is irrelevant, count and membership are not.
  return keys.length === Object.keys(y).length && keys.every((k) => k in y && isEqual(x[k], y[k]));
}

/**
 * `strict` exists because a slot arriving from Lua may carry a name and weight but no
 * count — a shop entry with unlimited stock, for instance. Callers that are about to do
 * arithmetic on `count` pass true.
 */
export const isSlotWithItem = (slot: Slot, strict: boolean = false): slot is SlotWithItem =>
  (slot.name !== undefined && slot.weight !== undefined) ||
  (strict && slot.name !== undefined && slot.count !== undefined && slot.weight !== undefined);

export const canStack = (sourceSlot: Slot, targetSlot: Slot) =>
  sourceSlot.name === targetSlot.name && isEqual(sourceSlot.metadata, targetSlot.metadata);

export const findAvailableSlot = (item: Slot, data: ItemData, slots: Slot[]) => {
  if (!data.stack) return slots.find((target) => target.name === undefined);

  const stackableSlot = slots.find(
    (target) => target.name === item.name && isEqual(target.metadata, item.metadata),
  );

  return stackableSlot || slots.find((target) => target.name === undefined);
};

/**
 * Which pane a wire type refers to.
 *
 * `container` used to be ambiguous: a bag opened while the inventory was up became the
 * third pane, and a bag opened from a closed inventory became the right-hand one. It is
 * not ambiguous any more — client.lua routes every way of opening a bag, the item, the
 * header button and the `openInventory('container', slot)` export alike, through
 * `client.openContainer`, so a bag is only ever the third pane. Preferring it is exact.
 */
export const paneOf = (state: State, type: Inventory['type']): Inventory => {
  if (type === InventoryType.PLAYER) return state.leftInventory;
  if (type === InventoryType.CONTAINER && state.containerInventory) return state.containerInventory;

  return state.rightInventory;
};

/**
 * Is this pane an inventory the server actually opened?
 *
 * The id is the honest marker, and the only one. An empty pane reaches here in two shapes:
 * the initial `emptyInventory()` before any window has opened, whose id is the empty
 * string, and — far more often — client.lua's `defaultInventory`, the `newdrop` pane shown
 * whenever there is nothing to your right, which carries no id at all. Everything the
 * server opens answers with one.
 *
 * Not item count, and not slot count: an open stash may legitimately be empty, and the
 * newdrop pane is sized like a real one.
 */
export const isOpenInventory = (inventory: Inventory): boolean => !!inventory.id;

/**
 * Which pane is which for a given move. With no target type, the destination is whichever
 * pane the source is not — that is the ctrl+click quick-move, and the same resolution the
 * shift-halving and Ctrl+Shift variants route through.
 *
 * THE PLAYER SIDE HAS TO LOOK TWICE. "The other pane" for an item in your pockets is the
 * right-hand one, and that pane is empty whenever a bag is the only thing open — which,
 * since a bag is always the third pane, is the common case. So when nothing foreign is
 * open the bag takes the quick-move instead.
 *
 * Checked rather than hoped: this is identical to the old behaviour in both cases that
 * actually occur. Bag only — the bag used to *be* the right-hand pane, and still receives
 * the item. Stash open — the right-hand pane wins, exactly as before. What is left when
 * neither holds is the newdrop pane, which is the old behaviour too: ctrl+click with
 * nothing open drops the item on the ground. Only the never-rendered `emptyInventory()`
 * has no slot to offer, and onDrop refuses that move rather than inventing one.
 */
const quickMoveTarget = (state: State, sourceType: Inventory['type']): Inventory => {
  if (sourceType !== InventoryType.PLAYER) return state.leftInventory;
  if (!isOpenInventory(state.rightInventory) && state.containerInventory)
    return state.containerInventory;

  return state.rightInventory;
};

export const getTargetInventory = (
  state: State,
  sourceType: Inventory['type'],
  targetType?: Inventory['type'],
): { sourceInventory: Inventory; targetInventory: Inventory } => ({
  sourceInventory: paneOf(state, sourceType),
  targetInventory: targetType ? paneOf(state, targetType) : quickMoveTarget(state, sourceType),
});

/**
 * The server's own guard, mirrored so a refused move is refused visibly instead of moving
 * and snapping back.
 *
 * `ox_inventory:swapItems` logs an exploit and drops any move where the two sides are of
 * different types and neither is the player. That is what stops a client naming two
 * foreign inventories at once, and it is worth more than the convenience of dragging
 * straight from a bag into a stash — so the drag says no, and the item goes via you.
 */
export const canMoveBetween = (fromType: Inventory['type'], toType: Inventory['type']) =>
  fromType === toType || fromType === InventoryType.PLAYER || toType === InventoryType.PLAYER;

/**
 * Durability as a percentage.
 *
 * A `durability` above 100 is not a percentage at all — it is an absolute expiry
 * timestamp, and `degrade` (in minutes) is the shelf life. That overload is why this
 * needs the current time passed in.
 */
export const itemDurability = (metadata: any, curTime: number): number | undefined => {
  if (metadata?.durability === undefined) return;

  let durability = metadata.durability;

  if (durability > 100 && metadata.degrade)
    durability = ((metadata.durability - curTime) / (60 * metadata.degrade)) * 100;

  if (durability < 0) durability = 0;

  return durability;
};

export const getTotalWeight = (slots: Inventory['items']) =>
  slots.reduce((total, slot) => (isSlotWithItem(slot) ? total + slot.weight : total), 0);

export const isContainer = (inventory: Inventory) => inventory.type === InventoryType.CONTAINER;

/** Can the player buy this? Shops may gate stock behind a job and grade. */
export const canPurchaseItem = (
  item: Slot,
  inventory: { type: Inventory['type']; groups: Inventory['groups'] },
  playerGroups: Inventory['groups'],
) => {
  if (inventory.type !== 'shop' || !isSlotWithItem(item)) return true;
  if (item.count !== undefined && item.count === 0) return false;
  if (item.grade === undefined || !inventory.groups) return true;

  // Shop requires groups but the player has none.
  if (!playerGroups) return false;

  const reqGroups = Object.keys(inventory.groups);

  if (Array.isArray(item.grade)) {
    for (const reqGroup of reqGroups) {
      const playerGrade = playerGroups[reqGroup];
      if (playerGrade === undefined) continue;
      if (item.grade.some((reqGrade) => playerGrade === reqGrade)) return true;
    }

    return false;
  }

  for (const reqGroup of reqGroups) {
    const playerGrade = playerGroups[reqGroup];
    if (playerGrade !== undefined && playerGrade >= item.grade) return true;
  }

  return false;
};

/**
 * Does the player hold every ingredient?
 *
 * An ingredient count below 1 means a *durability* requirement rather than a quantity —
 * `powersaw: 0.1` asks for a saw with at least 10% left, not for a tenth of a saw.
 */
export const canCraftItem = (item: Slot, inventoryType: string, playerItems: Slot[]) => {
  if (!isSlotWithItem(item) || inventoryType !== 'crafting') return true;
  if (!item.ingredients) return true;

  const missing = Object.entries(item.ingredients).filter(([name, count]) => {
    const globalItem = itemDefs[name];

    if (count >= 1 && globalItem && globalItem.count >= count) return false;

    const hasItem = playerItems.find((playerItem) => {
      if (!isSlotWithItem(playerItem) || playerItem.name !== name) return false;
      if (count < 1) return playerItem.metadata?.durability >= count * 100;
      return false;
    });

    return !hasItem;
  });

  return missing.length === 0;
};

/** Ask Lua for a definition the `init` payload did not carry, and cache it. */
export const getItemData = async (itemName: string) => {
  const resp: ItemData | null = await fetchNui('getItemData', itemName);

  if (resp?.name) {
    itemDefs[itemName] = resp;
    return resp;
  }
};

/**
 * Resolve a slot to an image URL.
 *
 * Order matters: an explicit `imageurl` in metadata wins (custom items), then a named
 * `image` in metadata, then the item definition's own image, then the item name.
 *
 * The React build cached the resolved path by writing it back to `itemData.image`. That
 * has to go: item definitions are $state now, and this is called from a $derived in
 * InventorySlot, so the write throws state_unsafe_mutation. No loss — the cache saved a
 * single template-string concatenation. The *read* of `itemData.image` stays, because a
 * definition can legitimately arrive from Lua with its own image path.
 */
export const getItemUrl = (item: string | SlotWithItem): string | undefined => {
  const isObj = typeof item === 'object';

  if (isObj) {
    if (!item.name) return;

    const metadata = item.metadata;

    if (metadata?.imageurl) return `${metadata.imageurl}`;
    if (metadata?.image) return `${imagePath.value}/${metadata.image}.png`;
  }

  const itemName = isObj ? (item.name as string) : item;
  const itemData = itemDefs[itemName];

  if (itemData?.image) return itemData.image;

  return `${imagePath.value}/${itemName}.png`;
};
