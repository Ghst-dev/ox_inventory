<script lang="ts">
  import { onDestroy } from 'svelte';
  import { drag, draggable, droppable, isDragging, type DropRelease } from '../lib/dnd.svelte';
  import { closeTooltip, openContextMenu, openSplitPrompt, openTooltip, ui } from '../lib/ui.svelte';
  import { inv } from '../lib/inventory.svelte';
  import { onBuy, onCraft, onDrop, onUse } from '../lib/actions';
  import {
    canCraftItem,
    canMoveBetween,
    canPurchaseItem,
    getItemUrl,
    getTargetInventory,
    isSlotWithItem,
  } from '../lib/helpers';
  import { isPinned } from '../lib/pins.svelte';
  import { items as itemDefs, locale } from '../lib/state.svelte';
  import { settings } from '../lib/settings.svelte';
  import { InventoryType, type DragSource, type Inventory, type Slot, type SlotWithItem } from '../typings';
  import Icon from '../lib/Icon.svelte';
  import { Pin } from '../lib/icons';
  import WeightBar from './WeightBar.svelte';

  let {
    item,
    inventoryType,
    inventoryGroups,
    dimmed = false,
  }: {
    item: Slot;
    inventoryType: Inventory['type'];
    inventoryGroups: Inventory['groups'];
    /**
     * Greyed because a search in this pane did not match it. Deliberately not the same
     * thing as `unavailable`, which means the server would refuse the purchase — a slot
     * dimmed by a search is still perfectly usable, and still a drop target.
     */
    dimmed?: boolean;
  } = $props();

  /**
   * One slot. Both a drag source and a drop target, as in the React build.
   *
   * The per-slot refreshSlots subscription is gone. Upstream gave every visible slot its
   * own listener that scanned the whole payload looking for itself, purely so it could
   * cancel an in-flight drag when the server rewrote the slot under the cursor — thirty
   * or more listeners doing the same scan. That now happens once, at the root.
   */

  const filled = $derived(isSlotWithItem(item));

  const purchasable = $derived(
    canPurchaseItem(item, { type: inventoryType, groups: inventoryGroups }, inv.leftInventory.groups),
  );
  const craftable = $derived(canCraftItem(item, inventoryType, inv.leftInventory.items));
  const available = $derived(purchasable && craftable);

  const imageUrl = $derived(filled ? getItemUrl(item as SlotWithItem) : undefined);

  // price, currency and grade only exist once a slot holds something; `filled` is the
  // guard, but the type only narrows through an explicit cast.
  const held = $derived(filled ? (item as SlotWithItem) : null);

  const label = $derived(
    item.metadata?.label ? item.metadata.label : (itemDefs[item.name!]?.label ?? item.name),
  );

  // Slots 1-5 of the player's inventory are reachable by number key, and are numbered on
  // the tile. Named "hotslot" rather than "hotbar" so it is never confused with the
  // hotbar component itself — Svelte's scoping keeps the two rules apart, but the name
  // collision is a reading trap.
  const isHotslot = $derived(inventoryType === InventoryType.PLAYER && item.slot <= 5);

  // Marked whether or not the slot holds anything: the pin is about the square, and an
  // empty pinned slot is a space being kept free on purpose.
  const pinned = $derived(isPinned(inventoryType, item.slot));

  // The weapon actually in the player's hands. Only their own pane can hold it.
  const equipped = $derived(
    inventoryType === InventoryType.PLAYER && ui.equippedSlot === item.slot && filled,
  );

  const source = (): DragSource | null => {
    // A shop slot is draggable even with a zero count so the purchase can be refused
    // with a message; elsewhere an empty slot is simply not a source.
    if (!isSlotWithItem(item, inventoryType !== InventoryType.SHOP)) return null;

    return {
      inventory: inventoryType,
      item: { name: item.name!, slot: item.slot },
      image: imageUrl ? `url(${imageUrl})` : undefined,
    };
  };

  function route(incoming: DragSource, amount?: number) {
    const target = { inventory: inventoryType, item: { slot: item.slot } };

    switch (incoming.inventory) {
      case InventoryType.SHOP:
        return onBuy(incoming, target, amount);
      case InventoryType.CRAFTING:
        return onCraft(incoming, target, amount);
      default:
        return onDrop(incoming, target, amount);
    }
  }

  function accept(incoming: DragSource, release: DropRelease) {
    /**
     * Alt on release asks how many instead of moving everything.
     *
     * Skipped for a crafting bench: `count` there is iterations of a recipe, not a
     * quantity sitting in a slot, so there is no honest ceiling to put on the slider.
     * Skipped for a single item for the obvious reason.
     */
    const { sourceInventory } = getTargetInventory(inv, incoming.inventory, inventoryType);
    const from = sourceInventory.items[incoming.item.slot - 1];
    const stack = from?.count ?? 0;

    if (release.alt && stack > 1 && incoming.inventory !== InventoryType.CRAFTING) {
      const name = from.metadata?.label || itemDefs[from.name!]?.label || from.name || '';

      return openSplitPrompt(name, stack, release.x, release.y, (amount) =>
        route(incoming, amount),
      );
    }

    return route(incoming);
  }

  const canDrop = (incoming: DragSource) =>
    (incoming.item.slot !== item.slot || incoming.inventory !== inventoryType) &&
    inventoryType !== InventoryType.SHOP &&
    inventoryType !== InventoryType.CRAFTING &&
    // The server refuses a move where neither side is the player, so with a bag open
    // beside a stash the drag between them is refused here rather than moving the item
    // and having it snap back. Feature 03's refusal state is what makes that legible.
    canMoveBetween(incoming.inventory, inventoryType);

  /**
   * The tooltip opens on a delay so that sweeping the cursor across the grid does not
   * flash one per slot. Anchored to the slot's rect rather than the cursor — see the
   * note in ui.svelte.ts.
   */
  const delay = () => settings.tooltipDelay;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;

  function onmouseenter(event: MouseEvent) {
    if (!isSlotWithItem(item)) return;

    // Never while dragging. Crossing the grid with an item held would otherwise arm a
    // tooltip on every slot passed over, and one would fire the moment you paused.
    // Upstream got this with `body.inv-dragging .item-slot-wrapper { pointer-events:
    // none }`, which works but also disables the hover styling it did not mean to.
    if (drag.source) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    hoverTimer = setTimeout(() => openTooltip(item as SlotWithItem, inventoryType, rect), delay());
  }

  function dismissTooltip() {
    clearTimeout(hoverTimer);
    closeTooltip();
  }

  onDestroy(() => clearTimeout(hoverTimer));

  function oncontextmenu(event: MouseEvent) {
    event.preventDefault();

    // Only the player's own items have actions worth listing; a shop slot has none.
    if (inventoryType !== InventoryType.PLAYER || !isSlotWithItem(item)) return;

    dismissTooltip();
    openContextMenu(item as SlotWithItem, event.clientX, event.clientY);
  }

  function onclick(event: MouseEvent) {
    dismissTooltip();

    if (!isSlotWithItem(item)) return;

    // ctrl+click sends the item to the other pane, alt+click uses it. Both are
    // documented in the controls panel and are how most players actually move things.
    if (event.ctrlKey && inventoryType !== 'shop' && inventoryType !== 'crafting') {
      onDrop({ inventory: inventoryType, item: { name: item.name!, slot: item.slot } });
    } else if (event.altKey && inventoryType === InventoryType.PLAYER) {
      onUse(item);
    }
  }

  const weightLabel = $derived.by(() => {
    if (!filled || !item.weight) return '';
    return item.weight >= 1000
      ? `${(item.weight / 1000).toLocaleString('en-us', { minimumFractionDigits: 2 })}kg`
      : `${item.weight.toLocaleString('en-us')}g`;
  });
</script>

<!-- The click handler is a modifier shortcut (ctrl to move, alt to use), not the slot's
     primary affordance — dragging is. Making this a <button> would put thirty-plus tab
     stops in a game overlay whose only keyboard contract is Escape to close, so the
     roles and key handlers a11y wants here would describe an interaction that does not
     exist. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="slot item-art"
  class:filled
  class:unavailable={!available}
  class:dimmed
  class:lifted={isDragging(inventoryType, item.slot)}
  class:hotslot={isHotslot}
  class:pinned
  class:equipped
  style:background-image={imageUrl ? `url(${imageUrl})` : undefined}
  use:draggable={{ source, canDrag: () => available }}
  use:droppable={{ canDrop, ondrop: accept }}
  {onclick}
  {oncontextmenu}
  {onmouseenter}
  onmouseleave={dismissTooltip}
  onpointerdown={dismissTooltip}
>
  {#if pinned}
    <span class="pin" aria-hidden="true"><Icon node={Pin} size="10px" /></span>
  {/if}

  {#if filled}
    <div class="head">
      {#if isHotslot}<span class="hotkey">{item.slot}</span>{/if}
      <span class="weight">{weightLabel}</span>
      <span class="count">{item.count ? `${item.count.toLocaleString('en-us')}x` : ''}</span>
    </div>

    <div class="foot">
      {#if inventoryType !== InventoryType.SHOP && item.durability !== undefined}
        <WeightBar percent={item.durability} durability />
      {/if}

      {#if inventoryType === InventoryType.SHOP && held?.price !== undefined && held.price > 0}
        {#if held.currency && held.currency !== 'money' && held.currency !== 'black_money'}
          <!-- Priced in an item rather than cash: show that item's own icon. -->
          <div class="price currency">
            <img src={getItemUrl(held.currency)} alt="" />
            <span>{held.price.toLocaleString('en-us')}</span>
          </div>
        {:else}
          <div class="price" class:cash={held.currency === 'money' || !held.currency}>
            {locale.$ || '$'}{held.price.toLocaleString('en-us')}
          </div>
        {/if}
      {/if}

      <div class="label">{label}</div>
    </div>
  {/if}
</div>

<style>
  .slot {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: var(--slot-size);
    background-color: var(--surface-sunken);
    background-size: 62%;
    background-position: center;
    background-repeat: no-repeat;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    transition:
      border-color var(--dur-fast) var(--ease-out),
      opacity var(--dur-fast) var(--ease-out);
  }

  .filled {
    cursor: grab;
  }

  .filled:hover {
    border-color: var(--primary-glow-border);
  }

  /* A hotbar slot is reachable by number key without opening anything, so it reads as
     slightly raised rather than as another cell in the grid. */
  .hotslot {
    background-color: var(--surface-raised);
  }

  /*
   * In hand right now, said on the strip that already names the item.
   *
   * Not on the tile's edge. The border is the drag layer's — accept is a dashed accent
   * border, refuse is a dashed red one — and a permanent accent marker anywhere near it
   * competes with the one thing a slot has to be able to say while you are dragging. The
   * name strip is the only part of the tile that is never spoken for, so the mark goes
   * there and the tooltip's "Equipped" line agrees with it.
   *
   * Tinted over the strip's own translucent ground rather than replacing it: the strip
   * sits on top of the item art, and an opaque background would black the weapon out
   * behind its own label. See the note on --primary-glow in tokens.css for why a tint is
   * composited rather than assigned.
   */
  .equipped .label {
    background: color-mix(
      in srgb,
      var(--color-primary) 20%,
      color-mix(in srgb, var(--color-bg) 70%, transparent)
    );
    color: var(--color-primary);
    font-weight: var(--font-weight-medium);
  }

  /*
   * A pin is a note to the tidy button, not a lock — the slot is dragged out of exactly as
   * before. So it is marked, not styled: a glyph in the corner rather than a different
   * border, which would read as a state the slot is in.
   */
  .pin {
    position: absolute;
    right: 3px;
    bottom: 3px;
    z-index: 1;
    display: flex;
    color: var(--color-dim);
    pointer-events: none;
  }

  .pinned:hover .pin {
    color: var(--color-primary);
  }

  /* Cannot afford it, cannot craft it, or the wrong job. Upstream used a CSS filter for
     this; a border and dimmed contents say the same thing without desaturating the
     item image into an unrecognisable grey blob. */
  .unavailable {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Lighter than .unavailable and with no cursor change, because a search miss is still
     a working slot — it is being pushed back, not switched off. Kept above .filled:hover
     in source order so hovering one still lifts its border. */
  .dimmed {
    opacity: 0.28;
    transition: opacity var(--dur-base) var(--ease-out);
  }

  .dimmed:hover {
    opacity: 0.7;
  }

  /* Set imperatively by the droppable action, so :global keeps Svelte from pruning it
     — see the note in dnd.svelte.ts. */
  .slot:global([data-dnd-over]) {
    border-color: var(--color-primary);
    border-style: dashed;
    /* Composited over the slot's own surface. --primary-glow is an 8%-alpha tint, so
       assigning it here would drop the sunken surface and let the game show through the
       one slot you are about to drop onto — see tokens.css. */
    background-color: color-mix(in srgb, var(--color-primary) 14%, var(--surface-sunken));
  }

  /* Hovered and refused. Before this the attribute was never set — a target that said no
     was reported as no target at all, so releasing over it looked identical to releasing
     over the gap between two slots. Composited over the surface for the same reason as
     the accept state above. */
  .slot:global([data-dnd-deny]) {
    border-color: var(--color-danger);
    border-style: dashed;
    background-color: color-mix(in srgb, var(--color-danger) 12%, var(--surface-sunken));
    cursor: not-allowed;
  }

  /* The slot the held item came from. Left as an outline rather than hidden, so the row
     does not reflow and the gap you are dragging out of stays legible. The count and
     label are the parts that would otherwise read as a second copy of the item. */
  .lifted {
    background-image: none !important;
    border-style: dashed;
    opacity: 0.4;
  }

  .lifted .head,
  .lifted .foot {
    visibility: hidden;
  }

  .head,
  .foot {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 5px;
    font-size: var(--text-meta);
    line-height: 1.2;
    background: color-mix(in srgb, var(--color-bg) 55%, transparent);
  }

  .foot {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    padding: 0;
    background: none;
  }

  .hotkey {
    color: var(--color-primary);
    font-weight: var(--font-weight-semibold);
  }

  .weight {
    color: var(--color-dim);
  }

  .count {
    margin-left: auto;
    color: var(--color-white);
  }

  .label {
    padding: 3px 5px;
    background: color-mix(in srgb, var(--color-bg) 70%, transparent);
    color: var(--color-gray);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The price sits directly over the item art, so it needs its own footing — upstream
     used a hard text-shadow for the same reason. A tinted strip reads more cleanly at
     this size than a shadow does. */
  .price {
    padding: 2px 5px;
    background: color-mix(in srgb, var(--color-bg) 62%, transparent);
    text-align: right;
    color: var(--color-danger-text);
    font-weight: var(--font-weight-medium);
  }

  .price.cash {
    color: var(--color-success);
  }

  .price.currency {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
  }

  .price.currency img {
    width: 12px;
    height: 12px;
    image-rendering: -webkit-optimize-contrast;
  }
</style>
