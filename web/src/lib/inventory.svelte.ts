/**
 * Inventory state, replacing the Redux Toolkit slice.
 *
 * OPTIMISTIC MUTATION. Every move is applied locally at once and only then sent to the
 * server, because waiting for a round-trip before the item visibly moves makes the
 * inventory feel broken. The server is still authoritative: a `false` reply puts
 * everything back.
 *
 * RTK expressed that with matchers — `isPending` on any thunk snapshotted both
 * inventories into `state.history`, `isRejected` restored them. That is elegant and
 * almost invisible, which is the problem: nothing in onDrop tells you a rollback exists.
 * Here it is a plain snapshot/rollback pair around the callback, spelled out.
 *
 * The five mutations (setup, refresh, swap, stack, move) are ports of the reducers of
 * the same names. Immer let them read as in-place mutation of a draft; $state proxies
 * allow the same thing directly, so they carry over closely.
 */

import type { Inventory, Slot, SlotWithItem, State } from '../typings';
import { InventoryType } from '../typings';
import { getItemData, getTargetInventory, itemDurability } from './helpers';
import { fetchNui } from './nui';
import { items as itemDefs } from './state.svelte';

const emptyInventory = (): Inventory => ({ id: '', type: '', slots: 0, maxWeight: 0, items: [] });

export const inv = $state<State>({
  leftInventory: emptyInventory(),
  rightInventory: emptyInventory(),
  additionalMetadata: [],
  itemAmount: 0,
  shiftPressed: false,
  isBusy: false,
});

/* -------------------------------------------------------------------------- */
/* Snapshot and rollback                                                       */
/* -------------------------------------------------------------------------- */

let history: { left: Inventory; right: Inventory } | null = null;

/**
 * $state.snapshot is the counterpart of RTK's `current()` — it unwraps the proxies into
 * a plain deep clone. Without it we would store live references and "restoring" them
 * would restore the mutated values.
 */
function snapshot(): void {
  history = {
    left: $state.snapshot(inv.leftInventory) as Inventory,
    right: $state.snapshot(inv.rightInventory) as Inventory,
  };
}

function rollback(): void {
  if (!history) return;

  inv.leftInventory = history.left;
  inv.rightInventory = history.right;
  history = null;
}

/**
 * Run an optimistic mutation against a server callback.
 *
 * Order is load-bearing and matches the original: snapshot first, mutate second, send
 * third. Snapshotting after the mutation would capture the state we might need to undo.
 *
 * One deliberate difference from RTK. Its matchers fired on *any* pending thunk, so a
 * second operation starting mid-flight would overwrite `history` with already-mutated
 * state and make the rollback restore the wrong thing. The React build never hit that
 * because `isBusy` sets pointer-events:none on the grid — but that is a CSS rule
 * guarding a state invariant, and the Use/Give targets sit outside the grid. Refusing
 * outright is cheap and does not depend on layout.
 */
async function commit(
  callback: string,
  payload: Record<string, unknown>,
  mutate: () => void,
): Promise<void> {
  if (inv.isBusy) return;

  snapshot();
  inv.isBusy = true;
  mutate();

  try {
    const response = await fetchNui<boolean | number>(callback, payload);

    if (response === false) rollback();
    // swapItems answers with a number when the target is a container: the container's
    // new weight, which belongs to the slot holding it in the other pane.
    else if (typeof response === 'number') setContainerWeight(response);
  } catch {
    rollback();
  } finally {
    inv.isBusy = false;
    history = null;
  }
}

function setContainerWeight(weight: number): void {
  const container = inv.leftInventory.items.find(
    (item) => item.metadata?.container === inv.rightInventory.id,
  );

  if (container) container.weight = weight;
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Expand a sparse inventory from Lua into a dense array of `slots` entries.
 *
 * Lua sends only the occupied slots, keyed arbitrarily; the grid needs slot N at index
 * N-1 so an empty slot is still a drop target. This is also where durability is
 * resolved and where a missing item definition is fetched.
 */
function buildInventory(source: Inventory): Inventory {
  const curTime = Math.floor(Date.now() / 1000);
  const bySlot = new Map<number, Slot>();

  for (const item of Object.values(source.items)) {
    if (item?.slot !== undefined) bySlot.set(item.slot, item);
  }

  return {
    ...source,
    items: Array.from({ length: source.slots }, (_, index) => {
      const item = bySlot.get(index + 1) ?? { slot: index + 1 };

      if (!item.name) return item;

      if (itemDefs[item.name] === undefined) getItemData(item.name);

      item.durability = itemDurability(item.metadata, curTime);
      return item;
    }),
  };
}

export function setupInventory(data: {
  leftInventory?: Inventory;
  rightInventory?: Inventory;
}): void {
  if (data.leftInventory) inv.leftInventory = buildInventory(data.leftInventory);
  if (data.rightInventory) inv.rightInventory = buildInventory(data.rightInventory);

  inv.shiftPressed = false;
  inv.isBusy = false;
}

export type ItemsPayload = { item: Slot; inventory?: string };

export interface RefreshPayload {
  items?: ItemsPayload | ItemsPayload[];
  itemCount?: Record<string, number>;
  weightData?: { inventoryId: string; maxWeight: number };
  slotsData?: { inventoryId: string; slots: number };
}

/** Which pane an id refers to, or null when it is neither of the two open ones. */
function paneFor(inventoryId: string): 'leftInventory' | 'rightInventory' | null {
  if (inventoryId === inv.leftInventory.id) return 'leftInventory';
  if (inventoryId === inv.rightInventory.id) return 'rightInventory';
  return null;
}

export function refreshSlots(payload: RefreshPayload): void {
  if (payload.items) {
    const list = Array.isArray(payload.items) ? payload.items : [payload.items];
    const curTime = Math.floor(Date.now() / 1000);

    for (const data of list) {
      if (!data) continue;

      // An absent `inventory` means the player's own — the left pane. Anything else
      // names the right pane, whatever it happens to be.
      const target =
        data.inventory && data.inventory !== InventoryType.PLAYER
          ? inv.rightInventory
          : inv.leftInventory;

      data.item.durability = itemDurability(data.item.metadata, curTime);
      target.items[data.item.slot - 1] = data.item;
    }
  }

  if (payload.itemCount) {
    for (const [name, count] of Object.entries(payload.itemCount)) {
      const definition = itemDefs[name];

      if (definition) definition.count += count;
      else console.log(`Item data for ${name} is undefined`);
    }
  }

  // SetMaxWeight while an inventory is open.
  if (payload.weightData) {
    const pane = paneFor(payload.weightData.inventoryId);
    if (pane) inv[pane].maxWeight = payload.weightData.maxWeight;
  }

  // A slot count change has to rebuild the pane, since the dense array is sized by it.
  if (payload.slotsData) {
    const pane = paneFor(payload.slotsData.inventoryId);

    if (pane) {
      inv[pane].slots = payload.slotsData.slots;
      inv[pane] = buildInventory($state.snapshot(inv[pane]) as Inventory);
    }
  }
}

interface MoveArgs {
  fromSlot: SlotWithItem;
  fromType: Inventory['type'];
  toSlot: Slot;
  toType: Inventory['type'];
  count: number;
}

/** Exchange two occupied slots. */
export function swapSlots(args: { fromSlot: SlotWithItem; fromType: string; toSlot: SlotWithItem; toType: string }) {
  const { fromSlot, fromType, toSlot, toType } = args;
  const { sourceInventory, targetInventory } = getTargetInventory(inv, fromType, toType);
  const curTime = Math.floor(Date.now() / 1000);

  const from = $state.snapshot(sourceInventory.items[fromSlot.slot - 1]) as Slot;
  const to = $state.snapshot(targetInventory.items[toSlot.slot - 1]) as Slot;

  sourceInventory.items[fromSlot.slot - 1] = {
    ...to,
    slot: fromSlot.slot,
    durability: itemDurability(toSlot.metadata, curTime),
  };

  targetInventory.items[toSlot.slot - 1] = {
    ...from,
    slot: toSlot.slot,
    durability: itemDurability(fromSlot.metadata, curTime),
  };
}

/** Merge `count` of the source into an existing stack. */
export function stackSlots(args: MoveArgs & { toSlot: SlotWithItem }) {
  const { fromSlot, fromType, toSlot, toType, count } = args;
  const { sourceInventory, targetInventory } = getTargetInventory(inv, fromType, toType);

  const pieceWeight = fromSlot.weight / fromSlot.count;

  targetInventory.items[toSlot.slot - 1] = {
    ...($state.snapshot(targetInventory.items[toSlot.slot - 1]) as Slot),
    count: toSlot.count + count,
    weight: pieceWeight * (toSlot.count + count),
  };

  // Shops and crafting benches have infinite supply — taking from one removes nothing.
  if (fromType === InventoryType.SHOP || fromType === InventoryType.CRAFTING) return;

  sourceInventory.items[fromSlot.slot - 1] =
    fromSlot.count - count > 0
      ? {
          ...($state.snapshot(sourceInventory.items[fromSlot.slot - 1]) as Slot),
          count: fromSlot.count - count,
          weight: pieceWeight * (fromSlot.count - count),
        }
      : { slot: fromSlot.slot };
}

/** Move `count` into an empty slot. */
export function moveSlots(args: MoveArgs) {
  const { fromSlot, fromType, toSlot, toType, count } = args;
  const { sourceInventory, targetInventory } = getTargetInventory(inv, fromType, toType);
  const pieceWeight = fromSlot.weight / fromSlot.count;
  const curTime = Math.floor(Date.now() / 1000);
  const fromItem = $state.snapshot(sourceInventory.items[fromSlot.slot - 1]) as Slot;

  targetInventory.items[toSlot.slot - 1] = {
    ...fromItem,
    count,
    weight: pieceWeight * count,
    slot: toSlot.slot,
    durability: itemDurability(fromItem.metadata, curTime),
  };

  if (fromType === InventoryType.SHOP || fromType === InventoryType.CRAFTING) return;

  sourceInventory.items[fromSlot.slot - 1] =
    fromSlot.count - count > 0
      ? {
          ...($state.snapshot(sourceInventory.items[fromSlot.slot - 1]) as Slot),
          count: fromSlot.count - count,
          weight: pieceWeight * (fromSlot.count - count),
        }
      : { slot: fromSlot.slot };
}

export function setAdditionalMetadata(entries: Array<{ metadata: string; value: string }>): void {
  for (const entry of entries) {
    if (!inv.additionalMetadata.find((el) => el.value === entry.value)) {
      inv.additionalMetadata.push(entry);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Server-backed operations                                                     */
/* -------------------------------------------------------------------------- */

export const validateMove = (
  payload: { fromSlot: number; fromType: string; toSlot: number; toType: string; count: number },
  mutate: () => void,
) => commit('swapItems', payload, mutate);

export const buyItem = (
  payload: { fromSlot: number; fromType: string; toSlot: number; toType: string; count: number },
  mutate: () => void,
) => commit('buyItem', payload, mutate);

export const craftItem = (
  payload: { fromSlot: number; fromType: string; toSlot: number; toType: string; count: number },
  mutate: () => void,
) => commit('craftItem', payload, mutate);
