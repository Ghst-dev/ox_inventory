<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { getItemUrl } from '../lib/helpers';
  import { inv } from '../lib/inventory.svelte';
  import { fetchNui } from '../lib/nui';
  import { items as itemDefs, locale } from '../lib/state.svelte';
  import { closeGivePicker, givePicker } from '../lib/ui.svelte';
  import Icon from '../lib/Icon.svelte';
  import { X } from '../lib/icons';

  /**
   * Which of the people standing here gets it.
   *
   * Only shown when there are at least two candidates — one person needs no question
   * asked, and none is not a choice. See onGive for where that decision is made.
   */

  const open = $derived(givePicker.open);

  /** Named at the top so it is obvious what is being handed over, not just to whom. */
  const item = $derived(inv.leftInventory.items[givePicker.slot - 1]);
  const label = $derived(
    item?.metadata?.label || itemDefs[item?.name ?? '']?.label || item?.name || '',
  );

  function give(target: number) {
    const { slot, count } = givePicker;

    closeGivePicker();
    fetchNui('giveItemTo', { target, slot, count });
  }

  function onkeydown(event: KeyboardEvent) {
    if (!open || event.key !== 'Escape') return;

    // Escape closes the inventory too; this is on top, so it takes it first.
    event.stopPropagation();
    closeGivePicker();
  }
</script>

<svelte:window {onkeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scrim" onclick={closeGivePicker} transition:fade={{ duration: 120 }}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(event) => event.stopPropagation()}
      transition:scale={{ duration: 150, start: 0.96 }}
    >
      <header>
        {#if item?.name}
          <div class="art" style:background-image="url({getItemUrl(item.name)})"></div>
        {/if}

        <div class="identity">
          <p class="title">{locale.ui_give || 'Give'}</p>
          <p class="what">
            {#if givePicker.count > 0}{givePicker.count}x {/if}{label}
          </p>
        </div>

        <button class="close" onclick={closeGivePicker} aria-label={locale.ui_close || 'Close'}>
          <Icon node={X} size="12px" />
        </button>
      </header>

      <ul class="targets">
        {#each givePicker.targets as target (target.id)}
          <li>
            <button class="target" onclick={() => give(target.id)}>
              <span class="name">{target.label}</span>
              <span class="id">#{target.id}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--scrim);
  }

  .dialog {
    width: 300px;
    max-width: calc(100vw - 48px);
    display: flex;
    flex-direction: column;
    background: var(--surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: inset 0 1px 0 var(--edge-highlight), var(--shadow-panel);
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--color-border);
  }

  .art {
    flex: none;
    width: 38px;
    height: 32px;
    background-color: var(--surface-sunken);
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  .identity {
    min-width: 0;
    flex: 1;
  }

  .title {
    margin: 0;
    font-size: var(--text-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-gray);
  }

  .what {
    margin: 2px 0 0;
    font-size: var(--text-sm);
    color: var(--color-white);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close {
    flex: none;
    display: flex;
    padding: 4px;
    border-radius: var(--radius-full);
    color: var(--color-dim);
  }

  .close:hover {
    color: var(--color-white);
  }

  .targets {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
    /* Six people in reach is already unusual; past that it scrolls rather than growing
       past the inventory behind it. */
    max-height: 260px;
    overflow-y: auto;
  }

  .target {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-gray);
    font-size: var(--text-sm);
    text-align: left;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .target:hover {
    background: var(--surface-panel);
    color: var(--color-white);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The server id disambiguates two players who have chosen the same name, which is the
     one thing a list of names alone cannot do. */
  .id {
    flex: none;
    font-family: var(--font-mono);
    font-size: var(--text-meta);
    color: var(--color-dim);
  }
</style>
