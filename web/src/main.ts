import { mount } from 'svelte';
import App from './App.svelte';
import { debugData, isEnvBrowser } from './lib/nui';
import './app.css';

// Give the browser a visible backdrop -- NUI pages are transparent by design, which
// makes them invisible against a white page during `pnpm dev`.
if (isEnvBrowser()) {
  document.documentElement.classList.add('nui-browser');
}

/**
 * Stand in for the `init` message client.lua sends once `uiLoaded` is answered. Phase 5
 * replaces this with a proper dev panel; for now it is the only way to see the
 * handshake complete outside the game.
 *
 * The shape is client.lua:1338 exactly — locale strings keyed by their `ui_` names,
 * every item definition on the server, and the player's own inventory.
 */
debugData([
  {
    action: 'init',
    data: {
      locale: {
        ui_use: 'Use',
        ui_give: 'Give',
        ui_close: 'Close',
        $: '$',
      },
      items: {
        water: { name: 'water', label: 'Water', stack: true, usable: true, close: true, count: 0 },
        lockpick: {
          name: 'lockpick',
          label: 'Lockpick',
          stack: true,
          usable: true,
          close: true,
          count: 0,
        },
        powersaw: {
          name: 'powersaw',
          label: 'Powersaw',
          stack: false,
          usable: true,
          close: true,
          count: 0,
        },
      },
      leftInventory: {
        id: 'test',
        type: 'player',
        slots: 50,
        maxWeight: 30000,
        items: [
          { slot: 1, name: 'water', weight: 100, count: 3 },
          { slot: 2, name: 'lockpick', weight: 500, count: 1 },
          { slot: 3, name: 'powersaw', weight: 0, count: 1, metadata: { durability: 75 } },
        ],
      },
      imagepath: 'nui://ox_inventory/web/images',
    },
  },
]);

const app = mount(App, { target: document.getElementById('root')! });

export default app;
