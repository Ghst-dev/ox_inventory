<script lang="ts">
  import { tick } from 'svelte';
  import { anchored } from '../lib/position';
  import { locale } from '../lib/state.svelte';
  import { closeSplitPrompt, splitPrompt } from '../lib/ui.svelte';

  /**
   * How many to move, asked at the moment of the drop.
   *
   * Opened by Alt-releasing a drag. Alt was the one free modifier: RMB is the context
   * menu, Ctrl+LMB quick-moves, Shift+drag halves, Ctrl+Shift+LMB moves half. Alt+LMB
   * uses an item, but that is a *click* — a press that never passes the drag threshold —
   * so it and Alt+drag can coexist without ambiguity.
   *
   * Positioned at the released pointer with the same `anchored` action as the context
   * menu, so it lands on the slot you were aiming at rather than in the middle of the
   * screen.
   */

  const open = $derived(splitPrompt.anchor !== null);
  const max = $derived(splitPrompt.max);

  let count = $state(1);
  let field = $state<HTMLInputElement | null>(null);

  /**
   * Reset and focus each time the prompt opens.
   *
   * Half is the useful default: it is what shift-drag would have given, so the common
   * case stays one keypress (Enter) and the uncommon one is a drag of the slider.
   */
  $effect(() => {
    if (!open) return;

    count = Math.max(1, Math.floor(max / 2));

    tick().then(() => {
      field?.focus();
      field?.select();
    });
  });

  function confirm() {
    const commit = splitPrompt.commit;
    const amount = Math.max(1, Math.min(max, Math.round(count) || 1));

    closeSplitPrompt();
    commit?.(amount);
  }

  function onkeydown(event: KeyboardEvent) {
    if (!open) return;

    // Both are also inventory-level shortcuts — Escape closes it, digits use a hot slot
    // — and this dialog is on top, so it takes them first.
    event.stopPropagation();

    if (event.key === 'Escape') closeSplitPrompt();
    else if (event.key === 'Enter') confirm();
  }
</script>

<svelte:window {onkeydown} />

{#if open}
  <!-- Clicking anywhere else abandons the split. Nothing is committed until Enter or the
       button, so dismissal is always the safe outcome. -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scrim" onclick={closeSplitPrompt} oncontextmenu={(e) => e.preventDefault()}></div>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="prompt"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    aria-label={locale.ui_split || 'Split'}
    onclick={(event) => event.stopPropagation()}
    use:anchored={{ anchor: splitPrompt.anchor, options: { side: 'point', gap: 0 } }}
  >
    <p class="title">{splitPrompt.label}</p>

    <div class="entry">
      <input
        class="field"
        type="number"
        min="1"
        {max}
        bind:this={field}
        bind:value={count}
        aria-label={locale.ui_split || 'Split'}
      />
      <span class="of">/ {max.toLocaleString('en-us')}</span>
    </div>

    <input class="slider" type="range" min="1" {max} step="1" bind:value={count} aria-label={locale.ui_split || 'Split'} />

    <div class="quick">
      <button onclick={() => (count = 1)}>1</button>
      <button onclick={() => (count = Math.max(1, Math.floor(max / 2)))}>½</button>
      <button onclick={() => (count = max)}>{locale.ui_all || 'All'}</button>
    </div>

    <button class="confirm" onclick={confirm}>{locale.ui_move || 'Move'}</button>
  </div>
{/if}

<style>
  /*
   * Invisible, but present: without something covering the grid, the click that
   * dismisses the prompt would land on a slot and start another drag.
   */
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 79;
  }

  .prompt {
    position: fixed;
    z-index: 80;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 180px;
    padding: 10px;
    background: var(--surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: inset 0 1px 0 var(--edge-highlight), var(--shadow-panel);
  }

  .title {
    margin: 0;
    font-size: var(--text-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-gray);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .field {
    width: 100%;
    padding: 5px 8px;
    background: var(--surface-sunken);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-white);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    text-align: center;
    /* Chromium's number spinner cannot be themed — it stays a pale native control however dark
       the field around it is — so it goes, the way ghst_hud's NumberField does it. Both
       properties are needed: the first for the field, the second for the buttons inside it.
       No chevrons replace them here: the slider and the three presets below already are the
       adjust affordance, which is why this field is the one place a bare number is enough. */
    appearance: textfield;
  }

  .field::-webkit-outer-spin-button,
  .field::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }

  .field:focus {
    border-color: var(--primary-glow-border);
    outline: none;
    box-shadow: var(--ring-accent);
  }

  .of {
    font-family: var(--font-mono);
    font-size: var(--text-meta);
    color: var(--color-dim);
    white-space: nowrap;
  }

  .slider {
    width: 100%;
    accent-color: var(--color-primary);
  }

  .quick {
    display: flex;
    gap: 4px;
  }

  .quick button {
    flex: 1;
    padding: 4px 0;
    background: var(--surface-sunken);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-gray);
    font-size: var(--text-meta);
    transition:
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .quick button:hover {
    border-color: var(--primary-glow-border);
    color: var(--color-white);
  }

  .confirm {
    padding: 6px 0;
    background: var(--surface-panel);
    border: 1px solid var(--primary-glow-border);
    border-radius: var(--radius-sm);
    color: var(--color-primary);
    font-size: var(--text-sm);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .confirm:hover {
    /* Tinted over the panel surface rather than filled with the accent — see tokens.css. */
    background: rgba(20, 46, 50, 0.931);  /* CEF 103 has no color-mix() -- see theme/base.css */
    background: color-mix(in srgb, var(--color-primary) 14%, var(--surface-panel));
    color: var(--color-action);
  }
</style>
