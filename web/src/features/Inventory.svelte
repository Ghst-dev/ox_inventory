<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
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
  import {
    closeContextMenu,
    closeGivePicker,
    closeSplitPrompt,
    closeTooltip,
    closeWeaponPanel,
    ui,
  } from '../lib/ui.svelte';
  import { onUse } from '../lib/actions';
  import { play } from '../lib/audio';
  import { isSlotWithItem } from '../lib/helpers';
  import type { Inventory } from '../typings';
  import AttachmentPanel from './AttachmentPanel.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import GivePicker from './GivePicker.svelte';
  import InventoryControl from './InventoryControl.svelte';
  import InventoryGrid from './InventoryGrid.svelte';
  import SplitPrompt from './SplitPrompt.svelte';
  import Tooltip from './Tooltip.svelte';

  /**
   * The two panes and the messages that drive them.
   *
   * Phase 2 owns setupInventory, refreshSlots and visibility. The centre column
   * (amount box, Use/Give/Close), the hotbar, tooltips and the context menu are phase 3.
   */

  const offVisible = onNuiEvent<boolean>(
    'setInventoryVisible',
    (state) => (ui.inventoryOpen = state),
  );

  /**
   * Sound the inventory opening and closing.
   *
   * An effect on the shared flag rather than a call inside each of the four places that
   * set it — setInventoryVisible, setupInventory, closeInventory and the Escape handler
   * all change the same thing, and three of them would have been easy to miss. The first
   * run is skipped so a page load is not announced.
   */
  let sounded = false;

  $effect(() => {
    const open = ui.inventoryOpen;

    /**
     * `play` is called untracked, and that is not a precaution.
     *
     * It reads settings.volume to decide whether to make a sound at all, so calling it
     * inside the effect body makes the volume a dependency of *this* effect — and
     * dragging the volume slider then replays the open sound on every step. The harness
     * caught it: an open blip appeared in a window where the inventory had not opened.
     * Only the visibility flag belongs in the dependency set.
     */
    untrack(() => {
      if (sounded) play(open ? 'open' : 'close');
      sounded = true;
    });
  });

  /** Everything that has to stop when the inventory goes away. */
  function dismissAll() {
    // A drag surviving the inventory closing would drop into a pane that is no longer
    // on screen. React reached for manager.dispatch({type:'dnd-core/END_DRAG'}) here.
    endDrag();
    closeTooltip();
    closeContextMenu();
    closeSplitPrompt();
    closeWeaponPanel();
    closeGivePicker();
  }

  const offClose = onNuiEvent('closeInventory', () => {
    ui.inventoryOpen = false;
    dismissAll();
  });

  const offSetup = onNuiEvent<{ leftInventory?: Inventory; rightInventory?: Inventory }>(
    'setupInventory',
    (data) => {
      setupInventory(data);
      ui.inventoryOpen = true;
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

  // `false` rather than null on the wire: Lua cannot put a nil in a table and have it
  // survive the trip, so empty-handed is sent as false and normalised here.
  const offEquipped = onNuiEvent<number | false>(
    'setEquipped',
    (slot) => (ui.equippedSlot = slot === false ? null : slot),
  );

  /**
   * Escape closes the inventory. Handled on keyup rather than keydown to match the
   * original — and it must tell Lua, or the game keeps NUI focus and the player is
   * stuck looking at a closed inventory they cannot dismiss.
   */
  function onKeyUp(event: KeyboardEvent) {
    if (event.key === 'Shift') inv.shiftPressed = false;

    if (event.code !== 'Escape') return;

    ui.inventoryOpen = false;
    dismissAll();
    fetchNui('exit');
  }

  /**
   * True while the player is typing into something — the pane search, today.
   *
   * Without this, typing "1" into a search field would also use whatever is in the first
   * hot slot, which for a stack of bandages is a wasted bandage and for a weapon is worse.
   */
  const typing = () => {
    const el = document.activeElement;
    return (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLElement && el.isContentEditable)
    );
  };

  /**
   * Slots 1-5 are keybound out in the world, but not in here — so using a hot slot meant
   * closing the inventory first, which is the one moment you can see what is in them.
   */
  function useHotslot(index: number) {
    const slot = inv.leftInventory.items[index - 1];

    if (!slot || !isSlotWithItem(slot)) return;

    closeTooltip();
    closeContextMenu();
    onUse(slot);
  }

  // Shift halves a stack on drop. Tracked globally because the key may be pressed
  // before the drag starts and released after it ends.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Shift') inv.shiftPressed = true;

    if (drag.source || typing() || event.ctrlKey || event.altKey || event.metaKey) return;

    // event.code, not event.key: the top-row digits report the same code on every layout,
    // where key would be an umlaut on some of them.
    const match = /^Digit([1-5])$/.exec(event.code);

    if (match) {
      event.preventDefault();
      useHotslot(Number(match[1]));
    }
  }

  onDestroy(() => {
    offVisible();
    offClose();
    offSetup();
    offRefresh();
    offMetadata();
    offEquipped();
  });
</script>

<svelte:window onkeyup={onKeyUp} onkeydown={onKeyDown} />

{#if ui.inventoryOpen}
  <div class="wrapper" transition:fade={{ duration: 150 }}>
    <InventoryGrid inventory={inv.leftInventory} />
    <InventoryControl />
    <InventoryGrid inventory={inv.rightInventory} />
  </div>

  <!-- Both are fixed-position and viewport-clamped, so they sit outside the wrapper
       rather than inside a pane that would clip them. -->
  <Tooltip />
  <ContextMenu />
  <SplitPrompt />
  <AttachmentPanel />
  <GivePicker />
{/if}

<style>
  /*
   * Centred with flexbox rather than the usual top/left 50% plus a translate.
   *
   * The transform is not merely a different way to write this: a transformed element
   * becomes the containing block for any `position: fixed` descendant, so anything
   * inside that expected to cover the viewport instead covers this wrapper. That is
   * what happened to the controls dialog's scrim, which is rendered from
   * InventoryControl and so sits inside here — it darkened the two panes and nothing
   * else.
   *
   * Filling the viewport and centring the contents avoids the transform entirely, and
   * keeps it avoided for anything added inside later.
   */
  .wrapper {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;

    /* Centres within the space beside the dev drawer. 0 everywhere else — see app.css. */
    padding-left: var(--dev-shift);
  }
</style>
