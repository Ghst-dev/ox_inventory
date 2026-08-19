<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
  import { getItemUrl, isSlotWithItem } from '../lib/helpers';
  import { inv } from '../lib/inventory.svelte';
  import { onNuiEvent } from '../lib/nui';
  import { settings } from '../lib/settings.svelte';
  import { items as itemDefs } from '../lib/state.svelte';
  import { ui } from '../lib/ui.svelte';
  import type { Slot, SlotWithItem } from '../typings';
  import WeightBar from './WeightBar.svelte';

  /**
   * The first five player slots — the only part of this UI visible during normal play.
   *
   * WHAT IT CANNOT DO, AND WHY. Clicking a hot slot to use it is the obvious missing
   * feature and it is not reachable from here. The bar is only ever on screen while the
   * inventory is closed, and closing the inventory calls SetNuiFocus(false, false): the
   * page still renders, but every pointer event goes to the game instead. A click handler
   * added here would be a control that silently does nothing, so there is not one. Making
   * it work means Lua deciding to hold focus for the bar, which is a different feature
   * with a real cost — you cannot shoot while the cursor is captured.
   *
   * So what is left is what it shows and when it shows it, which is what changed here.
   */

  const HOLD_MS = 3000;

  /**
   * How long a slot stays marked after its contents change.
   *
   * The bar is fed by refreshSlots, which arrives whether the item was used from in here
   * or from the world keybind — so this is an honest "this just changed", not a
   * "you just pressed something". It is deliberately not a last-*used* marker: nothing
   * tells the UI which slot a world keypress used, and inferring it from a count going
   * down would be wrong every time a pickup lands in the same slot.
   */
  const PULSE_MS = 900;

  let flashing = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const persistent = $derived(settings.hotbar === 'always');

  /**
   * Stand down while the inventory is open. In `always` mode the bar would otherwise sit
   * at the bottom of the same viewport showing a second copy of slots 1-5, directly under
   * the pane already showing them.
   */
  const visible = $derived(!ui.inventoryOpen && (persistent || flashing));

  const slots = $derived(inv.leftInventory.items.slice(0, 5));

  const off = onNuiEvent('toggleHotbar', () => {
    // In `always` mode there is nothing to toggle; the key is left inert rather than
    // given a second meaning the keybind description does not mention.
    if (persistent) return;

    clearTimeout(timer);

    // A second press hides it immediately rather than extending the window.
    if (flashing) {
      flashing = false;
      return;
    }

    flashing = true;
    timer = setTimeout(() => (flashing = false), HOLD_MS);
  });

  /* ------------------------------------------------------------------------ */
  /* Change pulse                                                              */
  /* ------------------------------------------------------------------------ */

  /**
   * Everything a player would notice changing, and nothing they would not: durability is
   * floored because it ticks continuously for degrading items and would otherwise mark
   * the slot on every refresh.
   */
  const signature = (slot: Slot) =>
    isSlotWithItem(slot)
      ? `${slot.name}|${slot.count}|${Math.floor(slot.durability ?? -1)}|${slot.metadata?.ammo ?? -1}`
      : '';

  let pulsed = $state([false, false, false, false, false]);
  let seen: string[] = [];
  const pulseTimers: Array<ReturnType<typeof setTimeout> | undefined> = [];

  $effect(() => {
    const now = slots.map(signature);

    // First pass has nothing to compare against; marking all five on load would fire the
    // pulse every time the player spawns.
    if (seen.length) {
      now.forEach((sig, index) => {
        if (sig === seen[index]) return;

        clearTimeout(pulseTimers[index]);
        pulsed[index] = true;
        pulseTimers[index] = setTimeout(() => (pulsed[index] = false), PULSE_MS);
      });
    }

    seen = now;
  });

  onDestroy(() => {
    clearTimeout(timer);
    pulseTimers.forEach(clearTimeout);
    off();
  });

  const label = (item: SlotWithItem) =>
    item.metadata?.label || itemDefs[item.name]?.label || item.name;

  /**
   * A weapon's magazine, where it has one.
   *
   * Shown instead of the count rather than beside it: a weapon is always a stack of one,
   * so "1x" in that corner is a number that never changes sitting where the number that
   * does change should be.
   */
  const ammo = (item: SlotWithItem): number | undefined => item.metadata?.ammo;
</script>

{#if visible}
  <div class="hotbar" transition:fly={{ y: 20, duration: 180 }}>
    {#each slots as item, index (item.slot)}
      <div
        class="slot item-art"
        class:filled={isSlotWithItem(item)}
        class:pulsed={pulsed[index]}
        style:background-image={isSlotWithItem(item)
          ? `url(${getItemUrl(item as SlotWithItem)})`
          : undefined}
      >
        <span class="key">{item.slot}</span>

        {#if isSlotWithItem(item)}
          {@const rounds = ammo(item as SlotWithItem)}

          {#if rounds !== undefined}
            <span class="count" class:empty={rounds === 0}>{rounds}</span>
          {:else}
            <span class="count">{item.count}x</span>
          {/if}

          <div class="foot">
            {#if item.durability !== undefined}
              <WeightBar percent={item.durability} durability />
            {/if}
            <div class="label">{label(item as SlotWithItem)}</div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .hotbar {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
  }

  .slot {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: var(--slot-size);
    height: var(--slot-size);
    background-color: var(--surface-panel);
    background-size: 62%;
    background-position: center;
    background-repeat: no-repeat;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  /*
   * An empty hot slot is a fact, not a thing to look at. Recessing it lets the filled
   * ones read as a row of items rather than as five identical squares, which is the
   * whole job of a bar you glance at mid-fight.
   */
  .slot:not(.filled) {
    background-color: var(--surface-sunken);
    opacity: 0.45;
  }

  /*
   * The change mark. An outline rather than a border so nothing reflows, and an
   * animation rather than a transition so it ends on its own — base.css flattens
   * animation-duration under reduce-motion, which turns this into no mark at all
   * rather than a mark that never leaves.
   */
  .pulsed {
    animation: pulse var(--dur-slow, 240ms) var(--ease-out) 3;
  }

  @keyframes pulse {
    from {
      outline: 2px solid var(--color-action);
      outline-offset: -2px;
    }
    to {
      outline: 2px solid transparent;
      outline-offset: -2px;
    }
  }

  .key {
    position: absolute;
    top: 3px;
    left: 5px;
    font-size: var(--text-meta);
    color: var(--color-primary);
    font-weight: var(--font-weight-semibold);
  }

  .count {
    position: absolute;
    top: 3px;
    right: 5px;
    font-size: var(--text-meta);
    color: var(--color-white);
  }

  /* An empty magazine is the one number here worth interrupting someone over. */
  .count.empty {
    color: var(--color-danger);
    font-weight: var(--font-weight-semibold);
  }

  .foot {
    margin-top: auto;
  }

  .label {
    padding: 3px 5px;
    background: color-mix(in srgb, var(--color-bg) 70%, transparent);
    color: var(--color-gray);
    font-size: var(--text-meta);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
