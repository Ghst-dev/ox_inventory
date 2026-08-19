/**
 * Slots the tidy button is not allowed to touch.
 *
 * WHY THIS IS NOT SERVER STATE. The plan had pinning persisted through `SetMetadata`,
 * which would have made it a property of the *item*: this bandage is pinned, and the pin
 * travels with it wherever it goes. That is the wrong noun. What a player is expressing is
 * "leave slot 3 alone" — they want the third square to keep holding whatever they put
 * there, because that is the one their thumb knows. Pinning the item means the pin moves
 * the moment they use the last bandage and put something else there, which is precisely
 * when they wanted it to stay.
 *
 * A pin is therefore a fact about a slot, it is only ever read by this UI, and it costs
 * nothing to keep in localStorage next to the other preferences. No Lua, no metadata
 * write, no round-trip — and the same caveat as settings: per client, not per character.
 *
 * WHAT A PIN DOES AND DOES NOT DO. It excludes the slot from tidying. It deliberately does
 * not stop you dragging out of it; a lock that fights the player's own hands would be
 * worse than the problem it solves.
 */

import { InventoryType } from '../typings';

const STORAGE_KEY = 'ghst.inventory.pins';

/**
 * Slots 1-5 start pinned.
 *
 * They are bound to the number keys in here and out in the world, so a tidy that
 * rearranges them means pressing 2 for a bandage and drinking a beer. Seeding them as
 * *pins* rather than hard-coding the rule is what makes the behaviour visible — there is a
 * marker on each of the five saying why they did not move — and what lets a player who
 * does not use the hotbar turn it off.
 */
const DEFAULT_PINS = [1, 2, 3, 4, 5];

/**
 * Player inventory only.
 *
 * A stash has no hot slots and no muscle memory attached to it, and its id changes with
 * every property, vehicle boot and drop on the map — storing pins per stash would grow
 * without bound to protect something nobody asked to protect.
 */
export const pinnable = (type: string) => type === InventoryType.PLAYER;

function load(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_PINS];

    const stored = JSON.parse(raw);

    // Written by an older build, or by hand. Keep whole positive numbers and nothing else.
    if (!Array.isArray(stored)) return [...DEFAULT_PINS];

    return stored.filter(
      (slot): slot is number => typeof slot === 'number' && Number.isInteger(slot) && slot > 0,
    );
  } catch {
    return [...DEFAULT_PINS];
  }
}

/**
 * An array rather than a Set: `$state` proxies arrays, and a Set would need its own
 * reactivity dance for the sake of a membership test over at most a few dozen numbers.
 */
export const pins = $state<number[]>(load());

export const isPinned = (type: string, slot: number) => pinnable(type) && pins.includes(slot);

export function togglePin(type: string, slot: number): void {
  if (!pinnable(type)) return;

  const index = pins.indexOf(slot);

  if (index === -1) pins.push(slot);
  else pins.splice(index, 1);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch {
    // Storage full or unavailable. The pin holds for this session and is forgotten after,
    // which is better than refusing to pin at all.
  }
}
