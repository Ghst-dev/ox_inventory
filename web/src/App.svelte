<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fetchNui, isEnvBrowser, onNuiEvent } from './lib/nui';
  import { applyInit, type InitPayload } from './lib/state.svelte';
  import { suppressNativeDrag } from './lib/dnd.svelte';
  import { setupInventory } from './lib/inventory.svelte';
  import DragPreview from './features/DragPreview.svelte';
  import Inventory from './features/Inventory.svelte';
  import InventoryHotbar from './features/InventoryHotbar.svelte';
  import ItemNotifications from './features/ItemNotifications.svelte';
  import type { Inventory as InventoryType } from './typings';
  import type { Component } from 'svelte';

  /**
   * The `init` handshake.
   *
   * client.lua:1336 spins on `client.uiLoaded` before sending `init`, so the UI has to
   * announce itself first. Everything the inventory needs to render a label — every
   * locale string and every item definition on the server — arrives in that one
   * message, along with the player's own inventory.
   *
   * Ordering matters and the React build got it slightly wrong: it registered the
   * listener in an effect but called `fetchNui('uiLoaded')` during render, so the
   * subscription was set up *after* the request went out. Only the network round-trip
   * made it safe. Subscribing at component init and posting in onMount closes that.
   */

  const offInit = onNuiEvent<InitPayload & { leftInventory: InventoryType }>('init', (data) => {
    applyInit(data);
    setupInventory({ leftInventory: data.leftInventory });
  });

  /**
   * The dev drawer, loaded only in a dev build. Dynamic rather than a static import so
   * `import.meta.env.DEV` — a literal `false` in production — makes the branch dead code
   * and rollup drops the component and its fixtures from the bundle entirely.
   */
  let DevPanel = $state<Component | null>(null);

  onMount(() => {
    fetchNui('uiLoaded', {});

    if (import.meta.env.DEV && isEnvBrowser()) {
      import('./features/dev/DevPanel.svelte').then((module) => (DevPanel = module.default));
    }

    return suppressNativeDrag();
  });

  onDestroy(offInit);
</script>

<Inventory />

<!-- Both of these appear while the inventory is closed — the hotbar on a keypress, the
     notifications whenever an item changes hands — so they sit outside it. -->
<InventoryHotbar />
<ItemNotifications />

<!-- The preview follows the cursor across the whole app, so it lives above whatever is
     being dragged rather than inside any one pane. -->
<DragPreview />

{#if DevPanel}
  <DevPanel />
{/if}
