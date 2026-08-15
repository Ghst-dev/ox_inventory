<script lang="ts">
  import { getTotalWeight } from '../lib/helpers';
  import { inv } from '../lib/inventory.svelte';
  import type { Inventory } from '../typings';
  import InventorySlot from './InventorySlot.svelte';
  import WeightBar from './WeightBar.svelte';

  let { inventory }: { inventory: Inventory } = $props();

  /**
   * A pane of slots.
   *
   * PAGINATION IS LOAD-BEARING. Shops declare `slots: 5000`, and rendering five thousand
   * slots on open is what the 30-at-a-time window exists to avoid. It is kept as-is
   * rather than swapped for a virtual-list library — this already works, and a virtual
   * list would have to be taught about the drag layer's hit testing.
   */
  const PAGE_SIZE = 30;

  let page = $state(0);
  let visible = $derived(inventory.items.slice(0, (page + 1) * PAGE_SIZE));
  const hasMore = $derived(visible.length < inventory.items.length);

  // Switching panes (opening a different stash) has to start from the top again.
  $effect(() => {
    inventory.id;
    inventory.type;
    page = 0;
  });

  const weight = $derived(
    inventory.maxWeight !== undefined ? Math.floor(getTotalWeight(inventory.items) * 1000) / 1000 : 0,
  );

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
      <p class="weight">{format(weight)} / {format(inventory.maxWeight)} kg</p>
    {/if}
  </header>

  {#if inventory.maxWeight}
    <WeightBar percent={(weight / inventory.maxWeight) * 100} />
  {/if}

  <!-- isBusy blocks interaction while a move is in flight, so a second drag cannot race
       the first. The store also refuses concurrent operations outright; this is the
       visible half of that. -->
  <div class="grid slot-grid" style:pointer-events={inv.isBusy ? 'none' : 'auto'}>
    {#each visible as item (item.slot)}
      <InventorySlot
        {item}
        inventoryType={inventory.type}
        inventoryGroups={inventory.groups}
      />
    {/each}

    {#if hasMore}
      <div class="sentinel" use:sentinel></div>
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
    font-size: var(--text-meta);
    color: var(--color-dim);
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
</style>
