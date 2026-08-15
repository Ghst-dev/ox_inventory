import { mount } from 'svelte';
import App from './App.svelte';
import { debugData, isEnvBrowser } from './lib/nui';
import { nuiMocks } from './lib/mocks';
import './app.css';

// Give the browser a visible backdrop -- NUI pages are transparent by design, which
// makes them invisible against a white page during `pnpm dev`.
if (isEnvBrowser()) {
  document.documentElement.classList.add('nui-browser');

  // The rollback path is the one piece of inventory behaviour with no way to reach it
  // from the UI: it needs the *server* to refuse a move. Exposing the mock table lets
  // `__nuiMocks.swapItems = false` in the console stand in for a full inventory or a
  // weight limit. Dev builds only.
  (window as any).__nuiMocks = nuiMocks;
}

/**
 * Stand-ins for the messages client.lua sends. Phase 5 replaces these with a proper dev
 * panel; until then they are how the UI is driven outside the game.
 *
 * Shapes are taken from client.lua:1338 (init) and client.lua:290 (setupInventory).
 * Item images resolve against web/images, which vite serves from the project root — the
 * custom ones belonging to the server are excluded from the fork, so a few render blank.
 */
const items = {
  water: { name: 'water', label: 'Water', stack: true, usable: true, close: true, count: 0 },
  burger: { name: 'burger', label: 'Burger', stack: true, usable: true, close: true, count: 0 },
  lockpick: { name: 'lockpick', label: 'Lockpick', stack: true, usable: true, close: true, count: 0 },
  medikit: { name: 'medikit', label: 'Medikit', stack: true, usable: true, close: true, count: 0 },
  bandage: { name: 'bandage', label: 'Bandage', stack: true, usable: true, close: true, count: 0 },
  cola: { name: 'cola', label: 'eCola', stack: true, usable: true, close: true, count: 0 },
  WEAPON_PISTOL: {
    name: 'WEAPON_PISTOL',
    label: 'Pistol',
    stack: false,
    usable: true,
    close: true,
    count: 0,
    ammoName: 'ammo-9',
    description: 'A **standard** sidearm.\n\nHolds 12 rounds.',
    // Grouped and ungrouped buttons together, which is what the context menu has to
    // collapse into submenus without losing each button's original index.
    buttons: [
      { label: 'Inspect' },
      { label: 'Unload' },
      { label: 'Paint red', group: 'Paint' },
      { label: 'Paint blue', group: 'Paint' },
    ],
  },
  'ammo-9': { name: 'ammo-9', label: '9mm Rounds', stack: true, usable: false, close: false, count: 0 },
  at_suppressor: { name: 'at_suppressor', label: 'Suppressor', stack: false, usable: false, close: false, count: 0 },
  at_flashlight: { name: 'at_flashlight', label: 'Flashlight', stack: false, usable: false, close: false, count: 0 },
};

debugData([
  {
    action: 'init',
    data: {
      // client.lua:1272-1278 forwards every ui_* key plus `$` and ammo_type. Mirrored
      // here from locales/en.json so the dev harness exercises the same label paths the
      // game does — an empty label looks like a missing element rather than a missing
      // translation, which is exactly the sort of thing a harness should not hide.
      locale: {
        $: '$',
        ammo_type: 'Ammo type',
        ui_added: 'Added',
        ui_alt_lmb: 'Fast use an item',
        ui_ammo: 'Ammo',
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
        ui_remove_ammo: 'Remove ammo',
        ui_removeattachments: 'Remove attachments',
        ui_removed: 'Removed',
        ui_rmb: 'Open item context menu',
        ui_serial: 'Serial number',
        ui_shift_drag: 'Split item quantity into half',
        ui_tint: 'Tint',
        ui_use: 'Use',
        ui_usefulcontrols: 'Useful Controls',
      },
      items,
      imagepath: '/images',
      leftInventory: {
        id: 'test',
        type: 'player',
        label: 'Bob Smith',
        slots: 40,
        maxWeight: 30000,
        items: [
          { slot: 1, name: 'water', count: 3, weight: 300 },
          { slot: 2, name: 'burger', count: 2, weight: 440 },
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
          { slot: 7, name: 'cola', count: 5, weight: 500 },
        ],
      },
    },
  },
]);

// A second message, after init, so the right pane has something in it. In game this is
// what opening a stash or a shop sends.
debugData(
  [
    {
      action: 'setupInventory',
      data: {
        rightInventory: {
          id: 'stash1',
          type: 'stash',
          label: 'Storage',
          slots: 30,
          maxWeight: 100000,
          items: [
            { slot: 1, name: 'medikit', count: 4, weight: 800 },
            { slot: 2, name: 'bandage', count: 12, weight: 600 },
            { slot: 5, name: 'water', count: 8, weight: 800 },
          ],
        },
      },
    },
  ],
  1200,
);

const app = mount(App, { target: document.getElementById('root')! });

export default app;
