<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fetchNui, onNuiEvent } from './lib/nui';
  import { applyInit, type InitPayload } from './lib/state.svelte';
  import { suppressNativeDrag } from './lib/dnd.svelte';
  import { setupInventory } from './lib/inventory.svelte';
  import DragPreview from './features/DragPreview.svelte';
  import Inventory from './features/Inventory.svelte';
  import InventoryHotbar from './features/InventoryHotbar.svelte';
  import ItemNotifications from './features/ItemNotifications.svelte';
  import type { Inventory as InventoryType } from './typings';

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

  onMount(() => {
    fetchNui('uiLoaded', {});
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
