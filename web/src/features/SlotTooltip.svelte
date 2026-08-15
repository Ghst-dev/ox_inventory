<script lang="ts">
  import { getItemUrl } from '../lib/helpers';
  import { inv } from '../lib/inventory.svelte';
  import { renderMarkdown } from '../lib/markdown';
  import { items as itemDefs, locale } from '../lib/state.svelte';
  import type { Inventory, SlotWithItem } from '../typings';

  let { item, inventoryType }: { item: SlotWithItem; inventoryType: Inventory['type'] } = $props();

  const itemData = $derived(itemDefs[item.name]);
  const description = $derived(item.metadata?.description || itemData?.description);
  const ammoName = $derived(itemData?.ammoName ? itemDefs[itemData.ammoName]?.label : undefined);

  // Crafting benches list what a recipe costs, cheapest ingredient first.
  const ingredients = $derived(
    item.ingredients ? Object.entries(item.ingredients).sort((a, b) => a[1] - b[1]) : null,
  );

  const components = $derived<string[]>(item.metadata?.components ?? []);

  /**
   * Server-declared extra metadata rows, registered through the `displayMetadata`
   * message. Only shown when this particular item actually carries the field.
   */
  const extras = $derived(
    inv.additionalMetadata.filter((entry) => item.metadata?.[entry.metadata] !== undefined),
  );

  const ingredientLabel = (name: string, count: number) => {
    const label = itemDefs[name]?.label || name;
    if (count >= 1) return `${count}x ${label}`;
    if (count === 0) return label;
    // Below 1 an ingredient is a durability requirement, not a quantity.
    return `${count * 100}% ${label}`;
  };
</script>

<div class="tooltip">
  <header>
    <p class="name">{item.metadata?.label || itemData?.label || item.name}</p>
    {#if inventoryType === 'crafting'}
      <p class="meta">{(item.duration ?? 3000) / 1000}s</p>
    {:else if item.metadata?.type}
      <p class="meta">{item.metadata.type}</p>
    {/if}
  </header>

  {#if itemData}
    {#if description}
      <!-- Sanitised in renderMarkdown; item descriptions can carry player-written text. -->
      <div class="description">{@html renderMarkdown(description)}</div>
    {/if}

    {#if inventoryType === 'crafting'}
      <ul class="ingredients">
        {#each ingredients ?? [] as [name, count] (name)}
          <li>
            <img src={getItemUrl(name)} alt="" />
            <span>{ingredientLabel(name, count)}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <dl>
        {#if item.durability !== undefined}
          <dt>{locale.ui_durability}</dt>
          <dd>{Math.trunc(item.durability)}</dd>
        {/if}
        {#if item.metadata?.ammo !== undefined}
          <dt>{locale.ui_ammo}</dt>
          <dd>{item.metadata.ammo}</dd>
        {/if}
        {#if ammoName}
          <dt>{locale.ammo_type}</dt>
          <dd>{ammoName}</dd>
        {/if}
        {#if item.metadata?.serial}
          <dt>{locale.ui_serial}</dt>
          <dd class="mono">{item.metadata.serial}</dd>
        {/if}
        {#if components.length}
          <dt>{locale.ui_components}</dt>
          <dd>{components.map((c) => itemDefs[c]?.label ?? c).join(', ')}</dd>
        {/if}
        {#if item.metadata?.weapontint}
          <dt>{locale.ui_tint}</dt>
          <dd>{item.metadata.weapontint}</dd>
        {/if}
        {#each extras as entry (entry.metadata)}
          <dt>{entry.value}</dt>
          <dd>{item.metadata?.[entry.metadata]}</dd>
        {/each}
      </dl>
    {/if}
  {/if}
</div>

<style>
  .tooltip {
    width: 260px;
    padding: 10px 12px;
    background: var(--surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: inset 0 1px 0 var(--edge-highlight), var(--shadow-panel);
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    padding-bottom: 6px;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--color-border);
  }

  .name {
    color: var(--color-white);
    font-weight: var(--font-weight-medium);
  }

  .meta {
    flex: none;
    font-size: var(--text-meta);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-primary);
  }

  .description {
    margin-bottom: 6px;
    color: var(--color-gray);
    font-size: var(--text-sm);
  }

  /* Markdown output is generated, so its elements cannot be reached by scoped styles. */
  .description :global(p + p) {
    margin-top: 4px;
  }
  .description :global(strong) {
    color: var(--color-white);
    font-weight: var(--font-weight-medium);
  }
  .description :global(ul) {
    padding-left: 16px;
    list-style: disc;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 12px;
    font-size: var(--text-meta);
  }

  dt {
    color: var(--color-dim);
  }

  dd {
    text-align: right;
    color: var(--color-gray);
  }

  .mono {
    font-family: var(--font-mono);
  }

  .ingredients {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ingredients li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-meta);
    color: var(--color-gray);
  }

  .ingredients img {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }
</style>
