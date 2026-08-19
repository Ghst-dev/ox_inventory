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

  /**
   * Only quantities merge. Picking up water three times is one event that happened three
   * times and reads better as "Added 3x"; equipping a weapon twice is two separate state
   * changes, and collapsing them into "Equipped 2x" would be nonsense.
   */
  const COUNTABLE = new Set(['ui_added', 'ui_removed']);

  /** Which semantic colour the card carries. Gaining and losing an item are not the same
      event, and before this they were the same card in the same cyan. */
  const TONE: Record<string, string> = {
    ui_added: 'gain',
    ui_removed: 'loss',
  };

  interface Notification {
    id: number;
    item: SlotWithItem;
    /** The locale key, resolved at render so a late `init` still localises what is up. */
    key: string;
    count: number | null;
    timer: ReturnType<typeof setTimeout>;
  }

  let queue = $state<Notification[]>([]);
  let nextId = 0;

  /** Two cards merge only if they are the same action on the same thing. */
  const mergeKey = (item: SlotWithItem, key: string) =>
    `${key}|${item.name}|${item.metadata?.label ?? ''}`;

  function expire(id: number) {
    queue = queue.filter((entry) => entry.id !== id);
  }

  const off = onNuiEvent<[item: SlotWithItem, text: string, count?: number]>(
    'itemNotify',
    ([item, key, count]) => {
      const existing = COUNTABLE.has(key)
        ? queue.find((entry) => mergeKey(entry.item, entry.key) === mergeKey(item, key))
        : undefined;

      if (existing) {
        existing.count = (existing.count ?? 1) + (count ?? 1);
        // The card has just been re-said, so it gets a full lifetime again rather than
        // vanishing on the first one's schedule.
        clearTimeout(existing.timer);
        existing.timer = setTimeout(() => expire(existing.id), LIFETIME_MS);
        return;
      }

      // A counter rather than Date.now(): two notifications in the same millisecond
      // would otherwise share a key, and keyed lists reuse the wrong node.
      const id = nextId++;

      queue.push({
        id,
        item,
        key,
        count: count ?? null,
        timer: setTimeout(() => expire(id), LIFETIME_MS),
      });
    },
  );

  onDestroy(() => {
    queue.forEach((entry) => clearTimeout(entry.timer));
    off();
  });

  const label = (item: SlotWithItem) =>
    item.metadata?.label || itemDefs[item.name]?.label || item.name;
</script>

<div class="stack">
  {#each queue as entry (entry.id)}
    <div
      class="notification item-art {TONE[entry.key] ?? ''}"
      style:background-image={`url(${getItemUrl(entry.item)})`}
      transition:fly={{ x: 24, duration: 200 }}
      animate:flip={{ duration: 200 }}
    >
      <span class="action">
        {locale[entry.key] ?? entry.key}{entry.count && entry.count > 1 ? ` ${entry.count}x` : ''}
      </span>
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

  /*
   * Gaining and losing an item were the same card in the same cyan, so the only thing
   * separating them was a word read in the corner of the eye in under two and a half
   * seconds. Colour is carried on the border and the action strip only — the card's own
   * surface stays neutral, per the convention in tokens.css.
   *
   * No icon: at --slot-size the card is already an image, an action strip and a name, and
   * a glyph would be competing with the item art for the same 68 pixels.
   */
  .gain {
    border-color: color-mix(in srgb, var(--color-success) 45%, var(--color-border));
  }

  .gain .action {
    background: color-mix(in srgb, var(--color-success) 26%, var(--color-bg));
  }

  .loss {
    border-color: color-mix(in srgb, var(--color-danger) 45%, var(--color-border));
  }

  .loss .action {
    background: color-mix(in srgb, var(--color-danger) 26%, var(--color-bg));
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
