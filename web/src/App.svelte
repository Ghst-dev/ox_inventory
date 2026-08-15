<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fetchNui, onNuiEvent, isEnvBrowser } from './lib/nui';
  import { applyInit, locale, items, imagePath, type InitPayload } from './lib/state.svelte';
  import { suppressNativeDrag } from './lib/dnd.svelte';
  import DragPreview from './features/DragPreview.svelte';
  import DragHarness from './features/DragHarness.svelte';
  import type { Inventory } from './typings';

  /**
   * The `init` handshake, and nothing else yet.
   *
   * client.lua:1336 spins on `client.uiLoaded` before sending `init`, so the UI has to
   * announce itself first. Everything the inventory needs to render a label — every
   * locale string and every item definition on the server — arrives in that one
   * message, so until it lands there is nothing worth drawing.
   *
   * Ordering matters and the React build got it slightly wrong: it registered the
   * listener in an effect but called `fetchNui('uiLoaded')` during render, so the
   * subscription was set up *after* the request went out. Only the network round-trip
   * made it safe. Subscribing at component init and posting in onMount closes that.
   */

  let ready = $state(false);
  let leftInventory = $state<Inventory | null>(null);

  const offInit = onNuiEvent<InitPayload & { leftInventory: Inventory }>('init', (data) => {
    applyInit(data);
    // Consumed properly by the inventory store in phase 2; held here so the handshake
    // can be seen to have delivered a real payload rather than an empty one.
    leftInventory = data.leftInventory;
    ready = true;
  });

  onMount(() => {
    fetchNui('uiLoaded', {});
    return suppressNativeDrag();
  });

  onDestroy(offInit);

  const itemCount = $derived(Object.keys(items).length);
  const localeCount = $derived(Object.keys(locale).length);
</script>

<!-- The preview follows the cursor for the whole app, so it lives above whatever is
     being dragged rather than inside any one pane. -->
<DragPreview />

{#if isEnvBrowser()}
  <DragHarness />

  <!-- Scaffold readout, dev only. Replaced by the real two-pane inventory in phase 2;
       until then this is what proves the bridge works end to end. -->
  <div class="scaffold">
    <h1>ox_inventory</h1>
    <p class="sub">Svelte scaffold — phase 0</p>

    <dl>
      <dt>init</dt>
      <dd class:ok={ready}>{ready ? 'received' : 'waiting'}</dd>

      <dt>locale strings</dt>
      <dd class:ok={localeCount > 0}>{localeCount}</dd>

      <dt>item definitions</dt>
      <dd class:ok={itemCount > 0}>{itemCount}</dd>

      <dt>image path</dt>
      <dd class="path">{imagePath.value}</dd>

      <dt>left inventory</dt>
      <dd class:ok={!!leftInventory}>
        {leftInventory ? `${leftInventory.id} · ${leftInventory.slots} slots` : '—'}
      </dd>
    </dl>
  </div>
{/if}

<style>
  /* Parked in a corner rather than centred: the phase 1 harness owns the middle of the
     screen, and this is now a status readout rather than the main content. */
  .scaffold {
    position: absolute;
    right: 24px;
    bottom: 24px;
    min-width: 320px;
    padding: 20px 24px;
    background: var(--surface-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: inset 0 1px 0 var(--edge-highlight), var(--shadow-panel);
  }

  h1 {
    font-size: var(--text-heading);
    font-weight: var(--font-weight-semibold);
    letter-spacing: var(--tracking-display);
    line-height: var(--leading-heading);
  }

  .sub {
    margin-bottom: 16px;
    font-size: var(--text-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-dim);
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 20px;
    font-size: var(--text-sm);
  }

  dt {
    color: var(--color-gray);
  }

  dd {
    text-align: right;
    color: var(--color-dim);
  }

  dd.ok {
    color: var(--color-primary);
  }

  .path {
    font-family: var(--font-mono);
    font-size: var(--text-meta);
  }
</style>
