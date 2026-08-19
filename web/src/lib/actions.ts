/**
 * What a drop actually does — the former dnd/ folder.
 *
 * Each of these decides the shape of a move, applies it optimistically and sends it. The
 * branching over stack/swap/move and the guards around containers are ported closely
 * from the React build; they encode rules the server also enforces, and disagreeing with
 * the server here means an item that visibly moves and then snaps back.
 */

import type { DragSource, DropTarget, Slot, SlotWithItem } from '../typings';
import { InventoryType } from '../typings';
import {
  buyItem,
  craftItem,
  inv,
  moveSlots,
  stackSlots,
  swapSlots,
  validateMove,
} from './inventory.svelte';
import { canStack, findAvailableSlot, getTargetInventory, isSlotWithItem } from './helpers';
import { fetchNui } from './nui';
import { items as itemDefs } from './state.svelte';

/**
 * Move an item between slots, or to the other pane when no target is given.
 *
 * The no-target call is the ctrl+click quick-move: the destination is chosen by
 * findAvailableSlot, which prefers an existing stack over the first empty slot.
 *
 * `amount` is the split prompt's answer and overrides both the shift-halving and the
 * amount box. It is still clamped to what is in the slot: the prompt was opened against
 * a count read at drop time, and a refreshSlots can land between the release and the
 * confirmation.
 */
export function onDrop(
  source: DragSource,
  target?: DropTarget,
  amount?: number,
): void | Promise<void> {
  const { sourceInventory, targetInventory } = getTargetInventory(
    inv,
    source.inventory,
    target?.inventory,
  );

  const sourceSlot = sourceInventory.items[source.item.slot - 1] as SlotWithItem;
  const sourceData = itemDefs[sourceSlot?.name];

  if (sourceData === undefined) return console.error(`${sourceSlot?.name} item data undefined!`);

  if (sourceSlot.metadata?.container !== undefined) {
    // A container inside a container would nest weight calculations indefinitely.
    if (targetInventory.type === InventoryType.CONTAINER)
      return console.log(`Cannot store container ${sourceSlot.name} inside another container`);

    // Moving the bag you are currently looking inside of would orphan the open pane.
    if (inv.rightInventory.id === sourceSlot.metadata.container)
      return console.log(`Cannot move container ${sourceSlot.name} when opened`);
  }

  const targetSlot = target
    ? targetInventory.items[target.item.slot - 1]
    : findAvailableSlot(sourceSlot, sourceData, targetInventory.items);

  if (targetSlot === undefined) return console.error('Target slot undefined!');

  if (
    targetSlot.metadata?.container !== undefined &&
    inv.rightInventory.id === targetSlot.metadata.container
  )
    return console.log(
      `Cannot swap item ${sourceSlot.name} with container ${targetSlot.name} when opened`,
    );

  // Shift halves the stack; otherwise the amount box wins, clamped to what is there.
  // Shops are excluded from the halving because their stock is not the player's to split.
  const count = amount
    ? Math.min(amount, sourceSlot.count)
    : inv.shiftPressed && sourceSlot.count > 1 && sourceInventory.type !== 'shop'
      ? Math.floor(sourceSlot.count / 2)
      : inv.itemAmount === 0 || inv.itemAmount > sourceSlot.count
        ? sourceSlot.count
        : inv.itemAmount;

  const data = {
    fromSlot: sourceSlot,
    toSlot: targetSlot,
    fromType: sourceInventory.type,
    toType: targetInventory.type,
    count,
  };

  const payload = {
    fromSlot: sourceSlot.slot,
    toSlot: targetSlot.slot,
    fromType: sourceInventory.type,
    toType: targetInventory.type,
    count,
  };

  // Returned, not just called: tidy() awaits each move before deciding the next one, and
  // the store refuses concurrent operations anyway.
  return validateMove(payload, () => {
    if (!isSlotWithItem(targetSlot, true)) return moveSlots(data);

    if (sourceData.stack && canStack(sourceSlot, targetSlot))
      return stackSlots({ ...data, toSlot: targetSlot });

    swapSlots({ ...data, toSlot: targetSlot });
  });
}

/**
 * Buying differs from moving in two ways: the source pane is always the right one, and
 * a bare amount of 0 means one item rather than the whole stack — you rarely intend to
 * buy a shop's entire supply by dragging.
 */
export function onBuy(source: DragSource, target: DropTarget, amount?: number): void {
  const sourceSlot = inv.rightInventory.items[source.item.slot - 1];

  if (!isSlotWithItem(sourceSlot)) throw new Error(`Item ${source.item.slot} name === undefined`);
  if (sourceSlot.count === 0) return;

  const sourceData = itemDefs[sourceSlot.name];
  if (sourceData === undefined) return console.error(`Item ${sourceSlot.name} data undefined!`);

  const targetSlot = inv.leftInventory.items[target.item.slot - 1];
  if (targetSlot === undefined) return console.error('Target slot undefined');

  const count = amount
    ? Math.min(amount, sourceSlot.count)
    : inv.itemAmount !== 0
      ? sourceSlot.count && inv.itemAmount > sourceSlot.count
        ? sourceSlot.count
        : inv.itemAmount
      : 1;

  const data = {
    fromSlot: sourceSlot,
    toSlot: targetSlot,
    fromType: inv.rightInventory.type,
    toType: inv.leftInventory.type,
    count,
  };

  buyItem(
    {
      fromSlot: sourceSlot.slot,
      toSlot: targetSlot.slot,
      fromType: data.fromType,
      toType: data.toType,
      count,
    },
    () => {
      if (!isSlotWithItem(targetSlot, true)) return moveSlots(data);

      if (sourceData.stack && canStack(sourceSlot, targetSlot))
        return stackSlots({ ...data, toSlot: targetSlot });

      swapSlots({ ...data, toSlot: targetSlot });
    },
  );
}

/**
 * Crafting is fire-and-forget by design: client.lua answers cb(true) immediately and
 * then loops server-side, running a progress circle per iteration. There is deliberately
 * no optimistic mutation — the result arrives as refreshSlots when each one completes.
 */
export function onCraft(source: DragSource, target: DropTarget, amount?: number): void {
  const sourceSlot = inv.rightInventory.items[source.item.slot - 1];

  if (!isSlotWithItem(sourceSlot)) throw new Error(`Item ${source.item.slot} name === undefined`);
  if (sourceSlot.count === 0) return;

  if (itemDefs[sourceSlot.name] === undefined)
    return console.error(`Item ${sourceSlot.name} data undefined!`);

  const targetSlot = inv.leftInventory.items[target.item.slot - 1];
  if (targetSlot === undefined) return console.error('Target slot undefined');

  craftItem(
    {
      fromSlot: sourceSlot.slot,
      toSlot: targetSlot.slot,
      fromType: inv.rightInventory.type,
      toType: inv.leftInventory.type,
      count: amount ?? (inv.itemAmount === 0 ? 1 : inv.itemAmount),
    },
    () => {},
  );
}

export const onUse = (item: Slot): void => {
  fetchNui('useItem', item.slot);
};

export const onGive = (item: Slot): void => {
  fetchNui('giveItem', { slot: item.slot, count: inv.itemAmount });
};
