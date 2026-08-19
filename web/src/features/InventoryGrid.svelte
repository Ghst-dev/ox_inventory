<script lang="ts">
  import { getTotalWeight, isSlotWithItem } from '../lib/helpers';
  import { inv } from '../lib/inventory.svelte';
  import { items as itemDefs, locale } from '../lib/state.svelte';
  import { InventoryType, type Inventory, type Slot } from '../typings';
  import Icon from '../lib/Icon.svelte';
  import { Search, X } from '../lib/icons';
  import InventorySlot from './InventorySlot.svelte';
  import WeightBar from './WeightBar.svelte';

  let { inventory }: { inventory: Inventory } = $props();

  /**
   * A pane of slots.
   *
   * PAGINATION IS LOAD-BEARING. A police locker is seventy slots and a drop can be fifty;
   * rendering the lot on open is what the 30-at-a-time window exists to avoid. It is kept
   * as-is rather than swapped for a virtual-list library — this already works, and a
   * virtual list would have to be taught about the drag layer's hit testing.
   */
  const PAGE_SIZE = 30;

  /** Below this there is nothing to search, and the field is only clutter. */
  const SEARCH_THRESHOLD = 20;

  let page = $state(0);
  let query = $state('');

  const searchable = $derived(inventory.slots > SEARCH_THRESHOLD);
  const needle = $derived(query.trim().toLowerCase());

  /**
   * A CATALOGUE PANE MAY HIDE; A PLACE MAY ONLY DIM.
   *
   * buildInventory expands Lua's sparse slot list into a dense array so that slot N sits
   * at index N-1 and every empty slot is still a drop target. Filtering that array in the
   * player's own inventory — or a stash, or a drop — deletes exactly the holes people drop
   * into. So those panes keep every slot rendered and grey the non-matches instead.
   *
   * A shop or a crafting bench is a list of things you can have, not a place you can put
   * things: nothing in it is a drop target, so removing rows is safe and is the only way a
   * long catalogue becomes navigable.
   */
  const catalogue = $derived(
    inventory.type === InventoryType.SHOP || inventory.type === InventoryType.CRAFTING,
  );

  /** Label as the slot itself renders it, so searching matches what the player reads. */
  const slotText = (slot: Slot) =>
    `${slot.metadata?.label ?? ''} ${itemDefs[slot.name!]?.label ?? ''} ${slot.name ?? ''}`.toLowerCase();

  const matches = (slot: Slot) =>
    !needle || (isSlotWithItem(slot) && slotText(slot).includes(needle));

  const rows = $derived(catalogue && needle ? inventory.items.filter(matches) : inventory.items);

  let visible = $derived(rows.slice(0, (page + 1) * PAGE_SIZE));
  const hasMore = $derived(visible.length < rows.length);

  // Wrapped rather than passed by reference: `some` supplies the index as the second
  // argument, which isSlotWithItem reads as its `strict` flag — so every slot after the
  // first would be tested strictly.
  const filled = $derived(inventory.items.some((slot) => isSlotWithItem(slot)));
  const hits = $derived(needle ? inventory.items.filter(matches).length : -1);

  // Switching panes (opening a different stash) has to start from the top again, and the
  // previous pane's search must not silently narrow the new one.
  $effect(() => {
    inventory.id;
    inventory.type;
    page = 0;
    query = '';
  });

  /**
   * The visible half of `isBusy`, on a delay.
   *
   * Almost every move answers in well under a frame or two, and flashing a working state
   * on each one is worse than showing nothing. This only appears once a round-trip is slow
   * enough that the player would otherwise think the UI had frozen — which, before this,
   * was indistinguishable from it having frozen, because isBusy's only effect was to
   * switch pointer-events off.
   */
  const BUSY_DELAY_MS = 180;
  let stalled = $state(false);

  $effect(() => {
    if (!inv.isBusy) {
      stalled = false;
      return;
    }

    const timer = setTimeout(() => (stalled = true), BUSY_DELAY_MS);
    return () => clearTimeout(timer);
  });

  const weight = $derived(
    inventory.maxWeight !== undefined ? Math.floor(getTotalWeight(inventory.items) * 1000) / 1000 : 0,
  );

  const load = $derived(inventory.maxWeight ? (weight / inventory.maxWeight) * 100 : 0);

  /**
   * How full, in words.
   *
   * The bar has changed tone past 90% since it was written, but nothing outside the bar
   * reacted — so the only warning a player got was six pixels of colour they were not
   * looking at, and the first they knew of being full was a pickup that quietly failed.
   *
   * Thresholds match WeightBar's so the readout and the bar never disagree.
   */
  const strain = $derived(load > 90 ? 'over' : load > 75 ? 'heavy' : null);

  const strainLabel = $derived(
    strain === 'over'
      ? locale.ui_overloaded || 'Overloaded'
      : strain === 'heavy'
        ? locale.ui_heavy || 'Heavy'
        : '',
  );

  /** What an empty pane should say, which is not the same sentence in every pane. */
  const emptyLabel = $derived.by(() => {
    switch (inventory.type) {
      case InventoryType.SHOP:
        return locale.ui_empty_shop || 'Nothing for sale here';
      case InventoryType.CRAFTING:
        return locale.ui_empty_crafting || 'Nothing can be made here';
      case InventoryType.PLAYER:
        return locale.ui_empty_player || 'You are carrying nothing';
      default:
        return locale.ui_empty || 'Empty';
    }
  });

  /** Load the next page when the sentinel below the grid scrolls into view. */
  function sentinel(node: HTMLElement) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore) page += 1;
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  const format = (grams: number) => (grams / 1000).toLocaleString('en-us', { maximumFractionDigits: 2 });
</script>

<section class="pane">
  <header>
    <p class="title">{inventory.label ?? ''}</p>
    {#if inventory.maxWeight}
      <p class="weight" class:heavy={strain === 'heavy'} class:over={strain === 'over'}>
        {#if strainLabel}<span class="strain">{strainLabel}</span>{/if}
        {format(weight)} / {format(inventory.maxWeight)} kg
      </p>
    {/if}
  </header>

  {#if inventory.maxWeight}
    <WeightBar percent={(weight / inventory.maxWeight) * 100} />
  {/if}

  {#if searchable}
    <div class="search" class:active={!!needle}>
      <Icon node={Search} size="13px" />
      <input
        type="text"
        bind:value={query}
        placeholder={locale.ui_search || 'Search'}
        aria-label={locale.ui_search || 'Search'}
      />
      {#if needle}
        <button class="clear" onclick={() => (query = '')} aria-label={locale.ui_close || 'Close'}>
          <Icon node={X} size="11px" />
        </button>
      {/if}
    </div>
  {/if}

  <!-- isBusy blocks interaction while a move is in flight, so a second drag cannot race
       the first. The store also refuses concurrent operations outright; this is the
       visible half of that — `stalled` adds the part the player can actually see, but
       only once a round-trip is slow enough to be worth mentioning. -->
  <div
    class="grid slot-grid"
    class:stalled
    style:pointer-events={inv.isBusy ? 'none' : 'auto'}
  >
    {#each visible as item (item.slot)}
      <InventorySlot
        {item}
        inventoryType={inventory.type}
        inventoryGroups={inventory.groups}
        dimmed={!catalogue && !!needle && !matches(item)}
      />
    {/each}

    {#if hasMore}
      <div class="sentinel" use:sentinel></div>
    {/if}

    <!-- Three different nothings, and they are not interchangeable: a pane that holds
         nothing, a search that found nothing, and a pane that failed to load look
         identical without this. -->
    {#if !filled}
      <p class="empty">{emptyLabel}</p>
    {:else if needle && hits === 0}
      <p class="empty">{locale.ui_no_results || 'Nothing matches'}</p>
    {/if}
  </div>
</section>

<style>
  .pane {
    display: flex;
    flex-direction: column;
    gap: 8px;
    /*
     * Everything the pane has to fit, spelled out. Preflight makes this border-box, so
     * the width covers the panel's own padding and its 1px border as well as the
     * columns, the gaps and the scrollbar. Being a couple of pixels short is enough to
     * put a horizontal scrollbar under the grid; being generous is enough to make the
     * panel visibly lopsided. Both happened, hence the measured --grid-scrollbar.
     */
    width: calc(
      var(--slot-size) * var(--grid-cols) + var(--slot-gap) * (var(--grid-cols) - 1) +
        var(--pane-pad) * 2 + 2px
    );
    padding: var(--pane-pad);
    background: var(--surface-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: inset 0 1px 0 var(--edge-highlight), var(--shadow-panel);
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .title {
    font-size: var(--text-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-gray);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .weight {
    flex: none;
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: var(--text-meta);
    color: var(--color-dim);
    transition: color var(--dur-base) var(--ease-out);
  }

  .weight.heavy {
    color: var(--color-warn);
  }

  .weight.over {
    color: var(--color-danger-text);
  }

  /* The word carries the weight — literally the point of it — so it is the emphasised
     half and the numbers stay quiet behind it. */
  .strain {
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    font-weight: var(--font-weight-semibold);
  }

  /* Height comes from .slot-grid in app.css: a fixed five rows, so both panes match
     whatever they hold. grid-auto-rows keeps a partly-filled last row square. */
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--grid-cols), var(--slot-size));
    grid-auto-rows: var(--slot-size);
    gap: var(--slot-gap);

    /*
     * Grow rightwards into the panel's right padding by exactly the scrollbar's width,
     * so the scrollbar is drawn *in* that padding rather than beside it.
     *
     * Without this the gap from the last column to the panel edge is the padding plus
     * the scrollbar, while the gap on the left is the padding alone — a visibly
     * lopsided panel, and worse the wider the client's scrollbar is. With it the
     * columns sit symmetrically, and --grid-scrollbar drops out of the pane's width sum
     * entirely, so an unexpected scrollbar width can no longer clip a column either.
     */
    margin-right: calc(-1 * var(--grid-scrollbar));

    /* The columns are a fixed width and there are always exactly --grid-cols of them,
       so there is no circumstance in which this should scroll sideways. Saying so
       outright is what actually guarantees no horizontal scrollbar. */
    overflow-x: hidden;

    /* Always `scroll`, never `auto`: a six-slot crafting bench and a forty-slot
       inventory then reserve the same gutter and their columns line up, instead of
       differing by the width of a scrollbar depending on how full they are. The track
       is transparent, so an unused one is invisible. */
    overflow-y: scroll;
  }

  .sentinel {
    grid-column: 1 / -1;
    height: 1px;
  }

  /* ---- Search ------------------------------------------------------------ */

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 9px;
    background: var(--surface-sunken);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-dim);
    transition:
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .search:focus-within,
  .search.active {
    border-color: var(--primary-glow-border);
    color: var(--color-primary);
  }

  .search input {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    outline: none;
    color: var(--color-white);
    font-family: inherit;
    font-size: var(--text-sm);
  }

  .search .clear {
    flex: none;
    display: flex;
    padding: 2px;
    border-radius: var(--radius-full);
    color: var(--color-dim);
  }

  .search .clear:hover {
    color: var(--color-white);
  }

  /* ---- Empty and stalled ------------------------------------------------- */

  .empty {
    grid-column: 1 / -1;
    align-self: center;
    margin: 0;
    padding: 24px 8px;
    text-align: center;
    font-size: var(--text-sm);
    color: var(--color-dim);
    text-wrap: balance;
  }

  /* Deliberately understated: a move that takes a moment is not an error, and the grid
     has to stay readable underneath. The cursor carries most of the message. */
  .stalled {
    cursor: progress;
    opacity: 0.55;
    transition: opacity var(--dur-base) var(--ease-out);
  }
</style>
