<script lang="ts">
  import { onDestroy } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { getItemUrl } from '../lib/helpers';
  import { onNuiEvent } from '../lib/nui';
  import { items as itemDefs, locale } from '../lib/state.svelte';
  import type { SlotWithItem } from '../typings';

  /**
   * "Added 3x Water" style popups, driven by the `itemNotify` message.
   *
   * The React build wrapped this in a context provider with a useQueue hook and a manual
   * portal, so any component could push one — nothing ever did except the NUI listener
   * itself. It is just a list with a timeout here.
   */
  const LIFETIME_MS = 2500;

  interface Notification {
    id: number;
    item: SlotWithItem;
    text: string;
  }

  let queue = $state<Notification[]>([]);
  let nextId = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const off = onNuiEvent<[item: SlotWithItem, text: string, count?: number]>(
    'itemNotify',
    ([item, text, count]) => {
      // `text` is a locale key, not a string: 'ui_added', 'ui_removed', 'ui_equipped'.
      const label = locale[text] ?? text;
      // A counter rather than Date.now(): two notifications in the same millisecond
      // would otherwise share a key, and keyed lists reuse the wrong node.
      const id = nextId++;

      queue.push({ id, item, text: count ? `${label} ${count}x` : label });

      const timer = setTimeout(() => {
        queue = queue.filter((entry) => entry.id !== id);
        timers.delete(timer);
      }, LIFETIME_MS);

      timers.add(timer);
    },
  );

  onDestroy(() => {
    timers.forEach(clearTimeout);
    off();
  });

  const label = (item: SlotWithItem) =>
    item.metadata?.label || itemDefs[item.name]?.label || item.name;
</script>

<div class="stack">
  {#each queue as entry (entry.id)}
    <div
      class="notification"
      style:background-image={`url(${getItemUrl(entry.item)})`}
      transition:fly={{ x: 24, duration: 200 }}
      animate:flip={{ duration: 200 }}
    >
      <span class="action">{entry.text}</span>
      <span class="name">{label(entry.item)}</span>
    </div>
  {/each}
</div>

<style>
  .stack {
    position: absolute;
    right: 24px;
    bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-end;
    pointer-events: none;
  }

  .notification {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: var(--slot-size);
    height: var(--slot-size);
    background-color: var(--surface-raised);
    background-size: 62%;
    background-position: center;
    background-repeat: no-repeat;
    border: 1px solid var(--primary-glow-border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-raised);
    overflow: hidden;
  }

  .action {
    padding: 3px 5px;
    background: color-mix(in srgb, var(--color-primary) 22%, var(--color-bg));
    color: var(--color-white);
    font-size: var(--text-meta);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    text-align: center;
  }

  .name {
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
