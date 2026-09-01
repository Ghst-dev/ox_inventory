<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { locale } from '../lib/state.svelte';
  import {
    ACCENTS,
    DELAY_RANGE,
    SCALE_RANGE,
    reset,
    settings,
    type HotbarMode,
  } from '../lib/settings.svelte';
  import { prefs, setPref } from '../lib/prefs.svelte';
  import Icon from '../lib/Icon.svelte';
  import { X } from '../lib/icons';

  /**
   * Player preferences. Same modal shape as UsefulControls next door — a scrim, an
   * Escape, and no focus manager, because there is one dialog and it never nests.
   */

  let { open = $bindable(false) }: { open?: boolean } = $props();

  function onkeydown(event: KeyboardEvent) {
    if (!open || event.key !== 'Escape') return;

    // Escape also closes the inventory; this dialog is on top, so it wins.
    event.stopPropagation();
    open = false;
  }

  const HOTBAR_OPTIONS: Array<{ id: HotbarMode; key: string; fallback: string }> = [
    { id: 'flash', key: 'ui_hotbar_flash', fallback: 'On key' },
    { id: 'always', key: 'ui_hotbar_always', fallback: 'Always' },
  ];

  const delayLabel = $derived(
    settings.tooltipDelay === 0
      ? locale.ui_instant || 'Instant'
      : `${(settings.tooltipDelay / 1000).toFixed(1)}s`,
  );

  /**
   * The volume the thumb is at while it is being dragged, before anything is committed.
   *
   * The two sliders above this one write to local state and cost nothing. This one writes to
   * `ghst_prefs`, and it used to do that from `oninput` — so a single drag from silent to full
   * was up to twenty NUI round trips, twenty KVP writes, and twenty broadcasts fanned out to
   * every interface on the server, for one decision.
   *
   * It commits on `change` instead, which fires once, on release. The readout still has to
   * follow the thumb during the drag, and it cannot read `prefs.uiVolume` to do it — that value
   * belongs to `ghst_prefs` and only moves when the broadcast comes back, which is the whole
   * point of the transport. So the drag has a value of its own, and it is display only.
   */
  let dragging = $state<number | null>(null);
  const shownVolume = $derived(dragging ?? prefs.uiVolume);

  function commitVolume(value: number) {
    dragging = null;
    setPref('uiVolume', value);
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
        <p>{locale.ui_settings || 'Settings'}</p>
        <button class="close" onclick={() => (open = false)} aria-label={locale.ui_close || 'Close'}>
          <Icon node={X} size="12px" />
        </button>
      </header>

      <div class="rows">
        <div class="row">
          <span class="label">{locale.ui_accent || 'Accent'}</span>
          <div class="swatches">
            {#each ACCENTS as option (option.id)}
              <button
                class="swatch"
                class:on={settings.accent === option.id}
                style:--swatch={option.primary}
                title={option.label}
                aria-label={option.label}
                aria-pressed={settings.accent === option.id}
                onclick={() => (settings.accent = option.id)}
              ></button>
            {/each}
          </div>
        </div>

        <div class="row">
          <span class="label">{locale.ui_hotbar || 'Hotbar'}</span>
          <div class="segment">
            {#each HOTBAR_OPTIONS as option (option.id)}
              <button
                class="option"
                class:on={settings.hotbar === option.id}
                aria-pressed={settings.hotbar === option.id}
                onclick={() => (settings.hotbar = option.id)}
              >
                {locale[option.key] || option.fallback}
              </button>
            {/each}
          </div>
        </div>

        <div class="row">
          <span class="label">{locale.ui_slot_size || 'Slot size'}</span>
          <div class="control">
            <input
              type="range"
              min={SCALE_RANGE.min}
              max={SCALE_RANGE.max}
              step={SCALE_RANGE.step}
              bind:value={settings.scale}
              aria-label={locale.ui_slot_size || 'Slot size'}
            />
            <span class="value">{Math.round(settings.scale * 100)}%</span>
          </div>
        </div>

        <div class="row">
          <span class="label">{locale.ui_tooltip_delay || 'Tooltip delay'}</span>
          <div class="control">
            <input
              type="range"
              min={DELAY_RANGE.min}
              max={DELAY_RANGE.max}
              step={DELAY_RANGE.step}
              bind:value={settings.tooltipDelay}
              aria-label={locale.ui_tooltip_delay || 'Tooltip delay'}
            />
            <span class="value">{delayLabel}</span>
          </div>
        </div>

        <!--
          The two shared rows. These write to `ghst_prefs`, which owns them for every interface on
          the server, so the switch here and the one on the character screen are now the same
          switch. Neither applies its own change: the value comes back on the broadcast.
        -->
        <div class="row">
          <span class="label">{locale.ui_reduce_motion || 'Reduce motion'}</span>
          <button
            class="toggle"
            class:on={prefs.reduceMotion}
            role="switch"
            aria-checked={prefs.reduceMotion}
            aria-label={locale.ui_reduce_motion || 'Reduce motion'}
            onclick={() => setPref('reduceMotion', !prefs.reduceMotion)}
          >
            <span class="knob"></span>
          </button>
        </div>

        <div class="row">
          <span class="label">{locale.ui_volume || 'Interface volume'}</span>
          <div class="control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={shownVolume}
              oninput={(event) => (dragging = Number((event.currentTarget as HTMLInputElement).value))}
              onchange={(event) => commitVolume(Number((event.currentTarget as HTMLInputElement).value))}
              aria-label={locale.ui_volume || 'Interface volume'}
            />
            <span class="value">
              {shownVolume === 0 ? locale.ui_off || 'Off' : `${Math.round(shownVolume * 100)}%`}
            </span>
          </div>
        </div>
      </div>

      <footer>
        <span class="note">{locale.ui_settings_shared || 'The last two apply to every interface'}</span>
        <button class="reset" onclick={reset}>{locale.ui_reset || 'Reset'}</button>
      </footer>
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
    width: 380px;
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
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  header p {
    margin: 0;
    font-size: var(--text-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-gray);
  }

  .close {
    display: flex;
    padding: var(--space-1);
    border-radius: var(--radius-full);
    color: var(--color-dim);
  }

  .close:hover {
    color: var(--color-white);
  }

  .rows {
    display: flex;
    flex-direction: column;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  .label {
    font-size: var(--text-sm);
    color: var(--color-gray);
  }

  .swatches {
    display: flex;
    gap: var(--space-1-5);
  }

  .swatch {
    width: 20px;
    height: 20px;
    border-radius: var(--radius-full);
    background: var(--swatch);
    border: 2px solid transparent;
    outline: 1px solid var(--color-border);
    outline-offset: 1px;
    transition: outline-color var(--dur-fast) var(--ease-out);
  }

  .swatch:hover {
    outline-color: var(--color-gray);
  }

  .swatch.on {
    outline-color: var(--color-white);
    outline-width: 2px;
  }

  .control {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .segment {
    display: flex;
    background: var(--tint-sunken);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .option {
    padding: var(--space-1) var(--space-2);
    color: var(--color-dim);
    font-size: var(--text-meta);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .option:hover {
    color: var(--color-white);
  }

  .option.on {
    /* The accent state layer over the well's tint, per tokens.css -- no `color-mix()` and so no
       hand-computed fallback to keep in step with it. */
    background-color: var(--tint-sunken);
    background-image: var(--layer-selected);
    color: var(--color-primary);
  }

  .value {
    min-width: 44px;
    text-align: right;
    font-family: var(--font-mono);
    font-size: var(--text-meta);
    color: var(--color-dim);
  }

  input[type='range'] {
    width: 132px;
    accent-color: var(--color-primary);
  }

  .toggle {
    position: relative;
    width: 38px;
    height: 20px;
    padding: var(--space-0-5);
    border-radius: var(--radius-full);
    background: var(--tint-sunken);
    border: 1px solid var(--color-border);
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);
  }

  .toggle.on {
    border-color: var(--primary-glow-border);
  }

  .knob {
    display: block;
    width: 14px;
    height: 14px;
    border-radius: var(--radius-full);
    background: var(--color-dim);
    transform: translateX(0);
    transition:
      transform var(--dur-fast) var(--ease-out),
      background var(--dur-fast) var(--ease-out);
  }

  .toggle.on .knob {
    background: var(--color-primary);
    transform: translateX(18px);
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
  }

  .note {
    font-size: var(--text-meta);
    color: var(--color-dim);
  }

  .reset {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    color: var(--color-gray);
    font-size: var(--text-meta);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
  }

  .reset:hover {
    border-color: var(--primary-glow-border);
    color: var(--color-white);
  }
</style>
