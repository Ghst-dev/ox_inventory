/**
 * Payload fixtures for browser development.
 *
 * Every shape here is taken from the Lua that produces it, so the harness exercises the
 * same paths the game does. Where a field is easy to get subtly wrong the source line is
 * cited — an inventory that renders correctly against a made-up payload proves nothing.
 *
 * Browser only. main.ts fires `init` on load; DevPanel drives everything after.
 */

import type { Inventory, ItemData, SlotWithItem } from '../../typings';

/**
 * Lua only ever sends *occupied* slots — setupInventory expands them into the dense
 * array the grid needs. Typing the fixtures as SlotWithItem rather than Slot is what
 * lets a shop entry carry price/currency/grade and a recipe carry ingredients/duration;
 * those fields live on SlotWithItem, and Inventory['items'] is the wider Slot[].
 */
const occupied = (list: SlotWithItem[]): SlotWithItem[] => list;

/**
 * client.lua:1272-1278 forwards every `ui_*` locale key, plus `$` and `ammo_type`.
 * Mirrored from locales/en.json rather than trimmed to what is currently rendered — a
 * missing label looks like a missing element, which is exactly what a harness should
 * not hide.
 */
export const locale: Record<string, string> = {
  $: '$',
  ammo_type: 'Ammo type',
  ui_added: 'Added',
  ui_all: 'All',
  ui_attachments: 'Attachments',
  ui_attachments_hint: 'Parts can only be removed from the weapon in your hands',
  ui_alt_drag: 'Ask how many to move when the drag is released',
  ui_alt_lmb: 'Fast use an item',
  ui_ammo: 'Ammo',
  ui_cat_ammo: 'Ammo',
  ui_cat_component: 'Parts',
  ui_cat_document: 'Documents',
  ui_cat_drug: 'Narcotics',
  ui_cat_food: 'Food',
  ui_cat_material: 'Materials',
  ui_cat_medical: 'Medical',
  ui_cat_misc: 'Other',
  ui_cat_tool: 'Tools',
  ui_cat_valuable: 'Valuables',
  ui_cat_weapon: 'Weapons',
  ui_close: 'Close',
  ui_components: 'Components',
  ui_copy: 'Copy serial number',
  ui_ctrl_c: "When hovering over a weapon, copies it's serial number",
  ui_ctrl_lmb: 'Fast move a stack of items into another inventory',
  ui_ctrl_shift_lmb: 'Fast move half a stack of items into another inventory',
  ui_drop: 'Drop',
  ui_durability: 'Durability',
  ui_equipped: 'Equipped',
  ui_give: 'Give',
  ui_holstered: 'Holstered',
  ui_move: 'Move',
  ui_no_attachments: 'Nothing fitted',
  ui_off: 'Off',
  ui_pin: 'Pin slot',
  ui_remove: 'Remove',
  ui_remove_ammo: 'Remove ammo',
  ui_removeattachments: 'Remove attachments',
  ui_removed: 'Removed',
  ui_rmb: 'Open item context menu',
  ui_same_ammo: 'Same',
  ui_serial: 'Serial number',
  ui_split: 'Split',
  ui_volume: 'Volume',
  ui_shift_drag: 'Split item quantity into half',
  ui_tidy: 'Tidy',
  ui_tidy_hint: 'Stack and sort. Slots 1-5 stay where they are.',
  ui_tint: 'Tint',
  ui_unpin: 'Unpin slot',
  ui_use: 'Use',
  ui_vs: 'Against',
  ui_weight: 'Weight',
  ui_usefulcontrols: 'Useful Controls',
};

/**
 * `category` defaults to 'misc' the same way client.lua's resolution does, so a fixture
 * that forgets one behaves exactly like an item in data/items.lua that has none.
 */
const item = (name: string, label: string, extra: Partial<ItemData> = {}): ItemData => ({
  name,
  label,
  stack: true,
  usable: true,
  close: true,
  count: 0,
  category: 'misc',
  ...extra,
});

export const items: Record<string, ItemData> = {
  water: item('water', 'Water', { category: 'food' }),
  burger: item('burger', 'Burger', { category: 'food' }),
  cola: item('cola', 'eCola', { category: 'food' }),
  lockpick: item('lockpick', 'Lockpick', { category: 'tool' }),
  medikit: item('medikit', 'Medikit', { category: 'medical' }),
  bandage: item('bandage', 'Bandage', { category: 'medical' }),
  radio: item('radio', 'Radio', { stack: false, category: 'tool' }),
  garbage: item('garbage', 'Garbage'),
  scrapmetal: item('scrapmetal', 'Scrap Metal', { category: 'material' }),
  money: item('money', 'Cash', { usable: false, category: 'valuable' }),
  backpack: item('backpack', 'Backpack', { stack: false, category: 'tool' }),
  'ammo-9': item('ammo-9', '9mm Rounds', { usable: false, category: 'ammo' }),
  at_suppressor: item('at_suppressor', 'Suppressor', { stack: false, usable: false, category: 'component' }),
  at_flashlight: item('at_flashlight', 'Flashlight', { stack: false, usable: false, category: 'component' }),
  WEAPON_PISTOL: item('WEAPON_PISTOL', 'Pistol', {
    stack: false,
    category: 'weapon',
    ammoName: 'ammo-9',
    description: 'A **standard** sidearm.\n\nHolds 12 rounds.',
    // Grouped and ungrouped together: the context menu has to collapse the grouped ones
    // into a submenu without losing each button's index, which is what useButton wants.
    buttons: [
      { label: 'Inspect' },
      { label: 'Unload' },
      { label: 'Paint red', group: 'Paint' },
      { label: 'Paint blue', group: 'Paint' },
    ],
  }),
  WEAPON_KNIFE: item('WEAPON_KNIFE', 'Knife', { stack: false }),
};

/** The player's own inventory — always the left pane. */
export const player: Inventory = {
  id: 'test',
  type: 'player',
  label: 'Bob Smith',
  slots: 40,
  maxWeight: 30000,
  // Sparse and out of order, as Lua sends it: setupInventory has to expand this into a
  // dense array or empty slots are not drop targets.
  items: occupied([
    { slot: 7, name: 'cola', count: 5, weight: 500 },
    { slot: 1, name: 'water', count: 3, weight: 300 },
    { slot: 3, name: 'lockpick', count: 1, weight: 500 },
    {
      slot: 4,
      name: 'WEAPON_PISTOL',
      count: 1,
      weight: 1000,
      metadata: {
        durability: 62,
        serial: 'AB12CD34',
        ammo: 9,
        components: ['at_suppressor', 'at_flashlight'],
        type: 'Sidearm',
      },
    },
    { slot: 2, name: 'burger', count: 2, weight: 440 },
    // Degrading item: durability above 100 is an expiry timestamp, not a percentage,
    // and `degrade` is the shelf life in minutes (see itemDurability).
    {
      slot: 6,
      name: 'medikit',
      count: 1,
      weight: 200,
      metadata: { durability: Math.floor(Date.now() / 1000) + 1800, degrade: 60 },
    },
    // A bag. `metadata.container` is the id of the inventory it opens (modules/items/
    // server.lua:198 generates it) and `size` is {slots, maxWeight} — the pair the header
    // button in the player's pane looks for before it offers itself.
    {
      slot: 5,
      name: 'backpack',
      count: 1,
      weight: 1000,
      metadata: { container: 'container-bag1', size: [20, 20000] },
    },
  ]),
  groups: { police: 2 },
};

export const stash: Inventory = {
  id: 'stash1',
  type: 'stash',
  label: 'Storage',
  slots: 30,
  maxWeight: 100000,
  items: occupied([
    { slot: 1, name: 'medikit', count: 4, weight: 800 },
    { slot: 2, name: 'bandage', count: 12, weight: 600 },
    { slot: 5, name: 'water', count: 8, weight: 800 },
  ]),
};

/**
 * A shop. Prices and currencies drive the slot footer; `grade` gates purchase against
 * the player's groups, so the last row is deliberately out of reach — the player is
 * police grade 2, and it wants grade 4.
 */
export const shop: Inventory = {
  id: 'shop1',
  type: 'shop',
  label: 'General Store',
  slots: 12,
  items: occupied([
    { slot: 1, name: 'water', count: 50, weight: 100, price: 5 },
    { slot: 2, name: 'burger', count: 20, weight: 220, price: 12 },
    { slot: 3, name: 'bandage', count: 15, weight: 50, price: 40, currency: 'black_money' },
    { slot: 4, name: 'radio', count: 3, weight: 300, price: 250, currency: 'scrapmetal' },
    // Out of stock: count 0 must block the drag rather than fail on the server.
    { slot: 5, name: 'medikit', count: 0, weight: 200, price: 100 },
    { slot: 6, name: 'WEAPON_PISTOL', count: 2, weight: 1000, price: 5000, grade: 4 },
  ]),
  groups: { police: 1 },
};

/**
 * A crafting bench. `ingredients` below 1 are durability requirements rather than
 * quantities — powersaw: 0.1 means a saw with at least 10% left.
 */
export const crafting: Inventory = {
  id: 'bench1',
  type: 'crafting',
  label: 'Workbench',
  slots: 6,
  items: occupied([
    {
      slot: 1,
      name: 'lockpick',
      count: 1,
      weight: 500,
      duration: 5000,
      ingredients: { scrapmetal: 5, garbage: 2 },
    },
    {
      slot: 2,
      name: 'bandage',
      count: 1,
      weight: 50,
      duration: 2000,
      ingredients: { water: 1 },
    },
  ]),
};

/**
 * The right-hand pane when there is nothing to your right — client.lua's `defaultInventory`,
 * which every window carries whether or not it opened onto anything.
 *
 * It is not inert. Its slots are real drop targets, and dropping into one is how an item
 * reaches the ground; ctrl+click from the player's pane lands here too whenever no bag and
 * no foreign inventory are open. The empty id is the point: Lua sends none at all, and
 * `isOpenInventory` reads either as "nothing the server opened".
 */
export const newdrop: Inventory = {
  id: '',
  type: 'newdrop',
  slots: 40,
  maxWeight: 30000,
  items: [],
};

/**
 * A bag as the *right* pane. Nothing in client.lua produces this any more — a bag is always
 * a pane in the player's own column — but the server's forceOpenInventory export can still
 * push one, so the layout stays reachable from the drawer. Its id is the one the player
 * fixture's bag item carries, so it is recognisably the same bag.
 */
export const container: Inventory = {
  id: 'container-bag1',
  type: 'container',
  label: 'Duffel Bag',
  slots: 10,
  maxWeight: 20000,
  items: occupied([{ slot: 1, name: 'money', count: 12500, weight: 0 }]),
};

/**
 * Weapon components, answered by the `getItemData` callback rather than sent in `init`.
 *
 * A part bolted to a gun lives in metadata, not in a slot, so nothing has ever looked its
 * definition up — which is why the attachment panel asks for them one at a time. The real
 * callback returns the whole shared item table, so these carry `type` (the socket) and
 * `weight`, which the eight-key `init` summary does not have.
 */
export const components: Record<string, ItemData> = {
  at_suppressor: {
    name: 'at_suppressor',
    label: 'Suppressor',
    type: 'muzzle',
    weight: 280,
    stack: false,
    usable: false,
    close: true,
    count: 0,
  },
  at_flashlight: {
    name: 'at_flashlight',
    label: 'Flashlight',
    type: 'flashlight',
    weight: 120,
    stack: false,
    usable: false,
    close: true,
    count: 0,
  },
};

/**
 * What is in the bag. Sparse and out of order like everything Lua sends, so the third
 * pane goes through the same dense-array expansion the other two do.
 */
export const backpack: SlotWithItem[] = occupied([
  { slot: 2, name: 'bandage', count: 3, weight: 345 },
  { slot: 5, name: 'water', count: 2, weight: 1000 },
  // `repairkit` on purpose: an item the bag holds and `items` above does not define. Lua
  // answers that gap with getItemData, which the harness has no Lua to ask -- so this is the
  // one slot in the fixtures that behaves the way an unknown item really does, and it is why
  // Tidy reports `stalled` here rather than sorting all three. Anything relying on a
  // definition should be tested against the two rows above it.
  { slot: 8, name: 'repairkit', count: 1, weight: 2500 },
]);
