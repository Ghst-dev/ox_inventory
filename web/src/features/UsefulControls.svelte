<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { locale } from '../lib/state.svelte';
  import Icon from '../lib/Icon.svelte';
  import { X } from '../lib/icons';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  /**
   * The controls cheat sheet. A plain modal — floating-ui's overlay, focus manager and
   * dismiss handling were doing nothing here that a scrim and an Escape key do not.
   */
  const controls = $derived([
    { keys: 'RMB', description: locale.ui_rmb },
    { keys: 'ALT + LMB', description: locale.ui_alt_lmb },
    { keys: 'CTRL + LMB', description: locale.ui_ctrl_lmb },
    { keys: 'SHIFT + Drag', description: locale.ui_shift_drag },
    { keys: 'ALT + Drag', description: locale.ui_alt_drag },
    { keys: 'CTRL + SHIFT + LMB', description: locale.ui_ctrl_shift_lmb },
    { keys: 'CTRL + C', description: locale.ui_ctrl_c },
  ]);

  function onkeydown(event: KeyboardEvent) {
    if (!open || event.key !== 'Escape') return;

    // Escape also closes the inventory itself; the dialog is on top, so it wins.
    event.stopPropagation();
    open = false;
  }
</script>

<svelte:window {onkeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scrim" onclick={() => (open = false)} transition:fade={{ duration: 120 }}>
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
        <p>{locale.ui_usefulcontrols || 'Useful controls'}</p>
        <button class="close" onclick={() => (open = false)} aria-label="Close">
          <Icon node={X} size="12px" />
        </button>
      </header>

      <dl>
        {#each controls as control (control.keys)}
          <div class="row">
            <dt><kbd>{control.keys}</kbd></dt>
            <dd>{control.description ?? ''}</dd>
          </div>
        {/each}
      </dl>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: grid;
    place-items: center;
    background: var(--scrim);
  }

  .dialog {
    width: 420px;
    max-width: calc(100vw - 32px);
    padding: var(--space-4) var(--space-4);
    background: var(--surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: inset 0 1px 0 var(--edge-highlight), var(--shadow-panel);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--space-2);
    margin-bottom: var(--space-3);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-subheading);
    color: var(--color-white);
  }

  .close {
    padding: var(--space-1-5);
    color: var(--color-dim);
    border-radius: var(--radius-sm);
  }

  .close:hover {
    color: var(--color-danger-text);
  }

  dl {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .row {
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: var(--space-3);
    align-items: center;
  }

  kbd {
    display: inline-block;
    padding: var(--space-0-5) var(--space-1-5);
    background: var(--tint-sunken);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-primary);
    font-family: var(--font-mono);
    font-size: var(--text-meta);
  }

  dd {
    color: var(--color-gray);
    font-size: var(--text-sm);
  }
</style>
