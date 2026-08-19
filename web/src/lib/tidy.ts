/**
 * Merge what can be merged, then put everything in order.
 *
 * WHY THIS IS NOT A SERVER CALLBACK. The plan had this as "one Lua touch" — a batch
 * SwapSlots in modules/inventory/server.lua. It is written as a sequence of ordinary
 * moves instead, and that is a deliberate trade rather than an oversight.
 *
 * A new server routine that rewrites a whole inventory in place is the single most
 * dangerous thing in this backlog: get it wrong and players lose items, and there is no
 * way to try it from here — the harness has no server. Every move below goes through
 * `swapItems`, the same path a drag uses, which the server already validates and which
 * is exercised thousands of times a session. The worst outcome of a bug in this file is
 * an inventory that ends up in a different order than intended.
 *
 * WHAT IT COSTS. One server round-trip per move, and the store refuses concurrent
 * operations, so they are strictly sequential. Ten items is ten or so trips, which is
 * comfortably under a second; a full police locker is not, hence MAX_OPS. If this proves
 * slow in practice the fix is the batch callback after all — but then it can be written
 * against a known-correct reference implementation instead of from scratch.
 */

import { onDrop } from './actions';
import { categoryOf, categoryRank, slotLabel } from './categories';
import { canStack, isSlotWithItem } from './helpers';
import { inv } from './inventory.svelte';
import { isPinned } from './pins.svelte';
import { items as itemDefs } from './state.svelte';
import { InventoryType, type Inventory, type Slot } from '../typings';

/**
 * The ceiling on moves for one press.
 *
 * Hitting it leaves the pane partly tidied rather than untouched, which is the useful
 * failure: both phases work front-to-back, so what got done is done and pressing again
 * carries on. Sized so that a worst case is a couple of seconds rather than ten.
 */
const MAX_OPS = 60;

/**
 * Which slots are off limits.
 *
 * Arbitrary rather than a leading run, which is why both phases below work over an
 * explicit list of movable positions instead of counting from an offset. Slots 1-5 are
 * pinned by default, so the common case still reads as "the hotbar is left alone" — but a
 * player who pins slot 22 gets exactly the same protection there.
 */
const locked = (type: string, slot: number) => isPinned(type, slot);

export interface TidyResult {
  moves: number;
  /** Ran out of moves before finishing. Press again to continue. */
  capped: boolean;
  /** A move did not take effect, so the run stopped rather than acting on a stale model. */
  stalled: boolean;
}

const paneFor = (type: string): Inventory =>
  type === InventoryType.PLAYER ? inv.leftInventory : inv.rightInventory;

/** Category first, then the label as it is written on the slot, then bigger stacks first. */
function order(a: Slot, b: Slot): number {
  const rank = categoryRank(categoryOf(a) ?? 'misc') - categoryRank(categoryOf(b) ?? 'misc');
  if (rank) return rank;

  const label = slotLabel(a).localeCompare(slotLabel(b));
  if (label) return label;

  return (b.count ?? 0) - (a.count ?? 0);
}

export async function tidy(type: string): Promise<TidyResult> {
  const result: TidyResult = { moves: 0, capped: false, stalled: false };

  /**
   * One move, and a check that it happened.
   *
   * onDrop refuses some moves outright and only logs — a container into a container, or
   * the bag whose contents are currently open in the other pane. Without this check the
   * loops below would keep acting on a model of the pane that has stopped matching it.
   */
  const move = async (from: number, to: number, count: number): Promise<boolean> => {
    const items = paneFor(type).items;
    const source = items[from - 1];

    if (!isSlotWithItem(source)) return false;

    await onDrop(
      { inventory: type, item: { name: source.name, slot: from } },
      { inventory: type, item: { slot: to } },
      count,
    );

    result.moves += 1;

    const after = paneFor(type).items[from - 1];
    const moved = !isSlotWithItem(after) || after.name !== source.name || after.count !== source.count;

    if (!moved) result.stalled = true;

    return moved;
  };

  /* -- Phase one: pour every stackable item into the lowest slot already holding it. -- */

  // Restarted from the top after each merge rather than tracked incrementally: the pane is
  // a live store being rewritten under this loop, and re-reading it is both simpler and
  // the only thing that stays true if a move is refused.
  merging: while (result.moves < MAX_OPS && !result.stalled) {
    const items = paneFor(type).items;

    for (let i = 0; i < items.length; i++) {
      const source = items[i];

      if (locked(type, source.slot)) continue;
      if (!isSlotWithItem(source) || !itemDefs[source.name]?.stack) continue;

      // Targets are not filtered by `locked`: a pinned slot may absorb a loose stack of
      // what it already holds. That is more of the thing the player pinned, in the place
      // they pinned it — the one rearrangement of a hot slot nobody objects to.
      for (let j = 0; j < i; j++) {
        const target = items[j];

        if (!isSlotWithItem(target) || !canStack(source, target)) continue;
        if (!(await move(source.slot, target.slot, source.count))) break merging;

        continue merging;
      }
    }

    break;
  }

  /* -- Phase two: selection sort, which compacts into the empty slots on the way. -- */

  // The positions this sort is allowed to write into, in order. Pinned slots are absent,
  // so nothing is ever placed into one and nothing is ever taken out of one.
  const movable = paneFor(type)
    .items.map((slot) => slot.slot)
    .filter((slot) => !locked(type, slot));

  for (let index = 0; index < movable.length; index++) {
    if (result.moves >= MAX_OPS || result.stalled) break;

    const items = paneFor(type).items;
    const here = movable[index];

    const candidates = movable
      .slice(index)
      .map((slot) => items[slot - 1])
      .filter((slot) => isSlotWithItem(slot));

    // Nothing left to place: every movable slot from here on is already empty.
    if (!candidates.length) break;

    const wanted = candidates.reduce((best, slot) => (order(slot, best) < 0 ? slot : best));

    if (wanted.slot === here) continue;
    if (!(await move(wanted.slot, here, wanted.count!))) break;
  }

  result.capped = result.moves >= MAX_OPS;

  return result;
}
