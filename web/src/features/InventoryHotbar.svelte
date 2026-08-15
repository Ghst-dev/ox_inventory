<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
  import { getItemUrl, isSlotWithItem } from '../lib/helpers';
  import { inv } from '../lib/inventory.svelte';
  import { onNuiEvent } from '../lib/nui';
  import { items as itemDefs } from '../lib/state.svelte';
  import type { SlotWithItem } from '../typings';
  import WeightBar from './WeightBar.svelte';

  /**
   * The first five player slots, shown for three seconds when the player presses the
   * hotbar key. Independent of the inventory being open — this is the only part of the
   * UI visible during normal play.
   */
  const HOLD_MS = 3000;

  let visible = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const slots = $derived(inv.leftInventory.items.slice(0, 5));

  const off = onNuiEvent('toggleHotbar', () => {
    clearTimeout(timer);

    // A second press hides it immediately rather than extending the window.
    if (visible) {
      visible = false;
      return;
    }

    visible = true;
    timer = setTimeout(() => (visible = false), HOLD_MS);
  });

  onDestroy(() => {
    clearTimeout(timer);
    off();
  });

  const label = (item: SlotWithItem) =>
    item.metadata?.label || itemDefs[item.name]?.label || item.name;
</script>

{#if visible}
  <div class="hotbar" transition:fly={{ y: 20, duration: 180 }}>
    {#each slots as item (item.slot)}
      <div
        class="slot"
        class:filled={isSlotWithItem(item)}
        style:background-image={isSlotWithItem(item)
          ? `url(${getItemUrl(item as SlotWithItem)})`
          : undefined}
      >
        <span class="key">{item.slot}</span>

        {#if isSlotWithItem(item)}
          <span class="count">{item.count}x</span>

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
