/**
 * The category a slot belongs to, and the order categories are presented in.
 *
 * Shared because two features have to agree on it: the filter chips above a pane and the
 * tidy button that reorders it. If they disagreed, sorting would group items in an order
 * the chips do not list, which reads as a bug in both.
 *
 * The value itself is resolved in Lua — see the ItemData loop in client.lua. Nothing here
 * derives a category from an item name.
 */

import { isSlotWithItem } from './helpers';
import { items as itemDefs } from './state.svelte';
import type { Slot } from '../typings';

/**
 * Fixed, and deliberately not alphabetical or by count.
 *
 * For the chips it means a button does not move because the pane's contents changed. For
 * the sort it means the grouping is the same every time, which is the only reason a sorted
 * inventory is faster to read than an unsorted one.
 *
 * Weapon, ammo and parts lead because that is the order they are thought about in; misc
 * is last because it is the bucket. Names not listed sort after all of these,
 * alphabetically, so a category added to data/items.lua without touching this file still
 * appears — just at the end.
 */
export const CATEGORY_ORDER = [
  'weapon',
  'ammo',
  'component',
  'medical',
  'food',
  'drug',
  'tool',
  'material',
  'valuable',
  'document',
  'misc',
];

/** Null for an empty slot, which is neither in a category nor sortable. */
export const categoryOf = (slot: Slot): string | null =>
  isSlotWithItem(slot) ? (itemDefs[slot.name]?.category ?? 'misc') : null;

export const categoryRank = (name: string): number => {
  const index = CATEGORY_ORDER.indexOf(name);
  return index === -1 ? CATEGORY_ORDER.length : index;
};

/** The label a slot shows, so sorting matches what is actually read on screen. */
export const slotLabel = (slot: Slot): string =>
  slot.metadata?.label || itemDefs[slot.name!]?.label || slot.name || '';
