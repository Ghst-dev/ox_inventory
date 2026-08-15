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
  },
};

debugData([
  {
    action: 'init',
    data: {
      locale: { ui_use: 'Use', ui_give: 'Give', ui_close: 'Close', $: '$' },
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
            metadata: { durability: 62, serial: 'AB12CD34' },
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
