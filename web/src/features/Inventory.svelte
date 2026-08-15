<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { fetchNui, onNuiEvent } from '../lib/nui';
  import { drag, endDrag } from '../lib/dnd.svelte';
  import {
    inv,
    refreshSlots,
    setAdditionalMetadata,
    setupInventory,
    type ItemsPayload,
    type RefreshPayload,
  } from '../lib/inventory.svelte';
  import { closeContextMenu, closeTooltip } from '../lib/ui.svelte';
  import type { Inventory } from '../typings';
  import ContextMenu from './ContextMenu.svelte';
  import InventoryControl from './InventoryControl.svelte';
  import InventoryGrid from './InventoryGrid.svelte';
  import Tooltip from './Tooltip.svelte';

  /**
   * The two panes and the messages that drive them.
   *
   * Phase 2 owns setupInventory, refreshSlots and visibility. The centre column
   * (amount box, Use/Give/Close), the hotbar, tooltips and the context menu are phase 3.
   */

  let visible = $state(false);

  const offVisible = onNuiEvent<boolean>('setInventoryVisible', (state) => (visible = state));

  /** Everything that has to stop when the inventory goes away. */
  function dismissAll() {
    // A drag surviving the inventory closing would drop into a pane that is no longer
    // on screen. React reached for manager.dispatch({type:'dnd-core/END_DRAG'}) here.
    endDrag();
    closeTooltip();
    closeContextMenu();
  }

  const offClose = onNuiEvent('closeInventory', () => {
    visible = false;
    dismissAll();
  });

  const offSetup = onNuiEvent<{ leftInventory?: Inventory; rightInventory?: Inventory }>(
    'setupInventory',
    (data) => {
      setupInventory(data);
      visible = true;
    },
  );

  /**
   * One listener, not one per slot.
   *
   * Upstream subscribed inside InventorySlot, so all thirty-plus visible slots scanned
   * every payload looking for themselves. The only reason any of them cared was to
   * cancel a drag whose source had just been rewritten by the server — at which point
   * the item being held may no longer exist, and completing the drop would act on a
   * stale slot.
   */
  const offRefresh = onNuiEvent<RefreshPayload>('refreshSlots', (data) => {
    refreshSlots(data);

    if (!drag.source || !data.items) return;

    const list: ItemsPayload[] = Array.isArray(data.items) ? data.items : [data.items];
    const held = drag.source;

    const rewritten = list.some((entry) => {
      if (!entry?.item) return false;

      const pane =
        entry.inventory && entry.inventory !== 'player' ? inv.rightInventory : inv.leftInventory;

      return entry.item.slot === held.item.slot && pane.type === held.inventory;
    });

    if (rewritten) endDrag();
  });

  const offMetadata = onNuiEvent<Array<{ metadata: string; value: string }>>(
    'displayMetadata',
    setAdditionalMetadata,
  );

  /**
   * Escape closes the inventory. Handled on keyup rather than keydown to match the
   * original — and it must tell Lua, or the game keeps NUI focus and the player is
   * stuck looking at a closed inventory they cannot dismiss.
   */
  function onKeyUp(event: KeyboardEvent) {
    if (event.key === 'Shift') inv.shiftPressed = false;

    if (event.code !== 'Escape') return;

    visible = false;
    dismissAll();
    fetchNui('exit');
  }

  // Shift halves a stack on drop. Tracked globally because the key may be pressed
  // before the drag starts and released after it ends.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Shift') inv.shiftPressed = true;
  }

  onDestroy(() => {
    offVisible();
    offClose();
    offSetup();
    offRefresh();
    offMetadata();
  });
</script>

<svelte:window onkeyup={onKeyUp} onkeydown={onKeyDown} />

{#if visible}
  <div class="wrapper" transition:fade={{ duration: 150 }}>
    <InventoryGrid inventory={inv.leftInventory} />
    <InventoryControl />
    <InventoryGrid inventory={inv.rightInventory} />
  </div>

  <!-- Both are fixed-position and viewport-clamped, so they sit outside the wrapper
       rather than inside a pane that would clip them. -->
  <Tooltip />
  <ContextMenu />
{/if}

<style>
  .wrapper {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }
</style>
