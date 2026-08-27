<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { getItemData, getItemUrl } from '../lib/helpers';
  import { inv } from '../lib/inventory.svelte';
  import { fetchNui } from '../lib/nui';
  import { items as itemDefs, locale } from '../lib/state.svelte';
  import { closeWeaponPanel, weaponPanel } from '../lib/ui.svelte';
  import Icon from '../lib/Icon.svelte';
  import { X } from '../lib/icons';
  import WeightBar from './WeightBar.svelte';

  /**
   * What is bolted to a weapon, and taking it off again.
   *
   * This replaces the "Remove attachments" submenu in the right-click menu, which listed
   * parts as text and closed itself after each one — taking three things off a rifle meant
   * opening the same menu three times, reading three names you had to already know, and
   * getting no confirmation that any of it worked.
   */

  /**
   * Read live from the store rather than captured when the panel opened.
   *
   * removeComponent answers with a bare acknowledgement and the actual change arrives
   * later as refreshSlots, so a captured copy would never lose the part you just removed.
   */
  const item = $derived(
    weaponPanel.slot !== null ? inv.leftInventory.items[weaponPanel.slot - 1] : undefined,
  );

  const open = $derived(!!item?.name);
  const components = $derived<string[]>(item?.metadata?.components ?? []);

  /**
   * Ask for the full definition of each fitted part.
   *
   * A component already *has* a definition — modules/items/shared.lua folds every entry in
   * data.weapons into the same ItemList as ordinary items, so `init` sends one. But `init`
   * sends an eight-key summary (label, stack, close, count, description, buttons, ammoName,
   * image) and the socket a part fits, `type`, is not among them. getItemData answers with
   * the whole shared table, so that is where the socket comes from.
   *
   * Hence the guard is on `type`, not on the definition existing: guarding on the latter
   * looked right in the harness and would have fetched nothing at all in game. Asked names
   * are remembered so a part whose definition genuinely has no type is not re-fetched on
   * every render.
   */
  const asked = new Set<string>();

  $effect(() => {
    for (const name of components) {
      if (itemDefs[name]?.type || asked.has(name)) continue;

      asked.add(name);
      getItemData(name);
    }
  });

  const label = (name: string) => itemDefs[name]?.label || name;

  /** 'muzzle' -> 'Muzzle'. The socket names are lowercase single words in data/weapons.lua. */
  const socket = (name: string) => {
    const kind = itemDefs[name]?.type;
    return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : '';
  };

  /**
   * A removal that has been asked for but not yet confirmed.
   *
   * Deliberately not an optimistic removal. Lua refuses the request outright when the
   * weapon is not the one in hand — it answers the callback either way and notifies the
   * player separately — so a part taken off the list optimistically would have to be put
   * back, and there is no message that says to. Dimming for a moment says "sent", which
   * is all this side actually knows.
   */
  const PENDING_MS = 1200;
  let pending = $state<Record<string, boolean>>({});
  const timers: Array<ReturnType<typeof setTimeout>> = [];

  function remove(component: string) {
    if (weaponPanel.slot === null) return;

    pending[component] = true;
    timers.push(setTimeout(() => delete pending[component], PENDING_MS));

    fetchNui('removeComponent', { component, slot: weaponPanel.slot });
  }

  // Clear the pending marks whenever the panel closes, so re-opening it is not haunted by
  // a request from last time.
  $effect(() => {
    if (open) return;

    timers.splice(0).forEach(clearTimeout);
    pending = {};
  });

  function onkeydown(event: KeyboardEvent) {
    if (!open || event.key !== 'Escape') return;

    // Escape also closes the inventory; this is on top, so it wins.
    event.stopPropagation();
    closeWeaponPanel();
  }

  const serial = $derived(item?.metadata?.serial as string | undefined);
</script>

<svelte:window {onkeydown} />

{#if open && item}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scrim" onclick={closeWeaponPanel} transition:fade={{ duration: 120 }}>
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
        <div class="art" style:background-image="url({getItemUrl(item.name!)})"></div>

        <div class="identity">
          <p class="name">{item.metadata?.label || itemDefs[item.name!]?.label || item.name}</p>
          {#if serial}
            <p class="serial">{serial}</p>
          {/if}
        </div>

        <button class="close" onclick={closeWeaponPanel} aria-label={locale.ui_close || 'Close'}>
          <Icon node={X} size="12px" />
        </button>
      </header>

      {#if item.durability !== undefined}
        <div class="condition">
          <span class="caption">{locale.ui_durability || 'Durability'}</span>
          <WeightBar percent={item.durability} durability />
          <span class="figure">{Math.trunc(item.durability)}</span>
        </div>
      {/if}

      {#if components.length}
        <ul class="parts">
          {#each components as component (component)}
            <li class="part" class:pending={pending[component]}>
              <div class="thumb" style:background-image="url({getItemUrl(component)})"></div>

              <div class="text">
                <span class="part-name">{label(component)}</span>
                {#if socket(component)}
                  <span class="socket">{socket(component)}</span>
                {/if}
              </div>

              <button
                class="detach"
                onclick={() => remove(component)}
                aria-label="{locale.ui_remove || 'Remove'} {label(component)}"
              >
                <Icon node={X} size="12px" />
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">{locale.ui_no_attachments || 'Nothing fitted'}</p>
      {/if}

      <!-- Removal only works on the weapon currently in hand; Lua refuses otherwise and
           says so itself. Saying it here too means the refusal is not a surprise. -->
      <p class="note">{locale.ui_attachments_hint || 'Parts can only be removed from the weapon in your hands'}</p>
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
    width: 340px;
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
    width: 52px;
    height: 40px;
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

  .name {
    margin: 0;
    color: var(--color-white);
    font-size: var(--text-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .serial {
    margin: 2px 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-meta);
    color: var(--color-dim);
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

  .condition {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--color-border);
  }

  .caption {
    font-size: var(--text-meta);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-dim);
  }

  .condition :global(.track) {
    flex: 1;
  }

  .figure {
    min-width: 26px;
    text-align: right;
    font-family: var(--font-mono);
    font-size: var(--text-meta);
    color: var(--color-gray);
  }

  .parts {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .part {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-bottom: 1px solid var(--color-border);
    transition: opacity var(--dur-base) var(--ease-out);
  }

  /* Asked for, not yet confirmed. See the note on PENDING_MS. */
  .pending {
    opacity: 0.4;
  }

  .pending .detach {
    pointer-events: none;
  }

  .thumb {
    flex: none;
    width: 34px;
    height: 26px;
    background-color: var(--surface-sunken);
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    border-radius: var(--radius-sm);
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .part-name {
    color: var(--color-gray);
    font-size: var(--text-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .socket {
    font-size: var(--text-meta);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-dim);
  }

  .detach {
    flex: none;
    display: flex;
    padding: 5px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-dim);
    transition:
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .detach:hover {
    border-color: rgba(255, 80, 80, 0.45);  /* CEF 103 has no color-mix() -- see theme/base.css */
    border-color: color-mix(in srgb, var(--color-danger) 45%, transparent);
    color: var(--color-danger);
  }

  .empty {
    margin: 0;
    padding: 18px 14px;
    text-align: center;
    color: var(--color-dim);
    font-size: var(--text-sm);
  }

  .note {
    margin: 0;
    padding: 9px 14px;
    color: var(--color-dim);
    font-size: var(--text-meta);
  }
</style>
