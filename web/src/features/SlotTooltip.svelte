<script lang="ts">
  import { getItemUrl } from '../lib/helpers';
  import { inv } from '../lib/inventory.svelte';
  import { renderMarkdown } from '../lib/markdown';
  import { items as itemDefs, locale } from '../lib/state.svelte';
  import { ui } from '../lib/ui.svelte';
  import { InventoryType } from '../typings';
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

  /* ---- The weapon in hand ------------------------------------------------- */

  const isEquipped = $derived(
    inventoryType === InventoryType.PLAYER && ui.equippedSlot === item.slot,
  );

  const equippedSlot = $derived(
    ui.equippedSlot !== null ? inv.leftInventory.items[ui.equippedSlot - 1] : undefined,
  );

  /**
   * Compare against the weapon in hand, when this is a *different* weapon.
   *
   * WHAT THIS CANNOT TELL YOU. ox_inventory's data/weapons.lua carries a label, a weight,
   * a wear rate and an ammo name — no damage, range, fire rate or accuracy. So this
   * compares condition and load, not performance, and says so by only showing the three
   * things it actually knows. Real ballistics would mean reading GTA natives per weapon,
   * which is a different feature.
   *
   * The ammo line is the one most worth having: whether the gun you are looking at takes
   * the rounds already in your pockets.
   */
  const comparison = $derived.by(() => {
    if (isEquipped || !equippedSlot?.name || !itemData?.ammoName) return null;

    const other = itemDefs[equippedSlot.name];
    if (!other?.ammoName) return null;

    return {
      label: equippedSlot.metadata?.label || other.label || equippedSlot.name,
      durability: {
        mine: item.durability,
        theirs: equippedSlot.durability,
      },
      weight: { mine: item.weight, theirs: equippedSlot.weight },
      sameAmmo: other.ammoName === itemData.ammoName,
      ammoLabel: itemDefs[itemData.ammoName]?.label || itemData.ammoName,
    };
  });

  /** A signed figure, because the sign is the whole message. */
  const signed = (value: number, digits = 0) =>
    `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;

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
    {:else if isEquipped}
      <p class="meta equipped">{locale.ui_equipped || 'Equipped'}</p>
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

      {#if comparison}
        <div class="versus">
          <p class="against">{locale.ui_vs || 'Against'} {comparison.label}</p>

          <dl>
            {#if comparison.durability.mine !== undefined && comparison.durability.theirs !== undefined}
              <dt>{locale.ui_durability}</dt>
              <dd class:better={comparison.durability.mine > comparison.durability.theirs}
                  class:worse={comparison.durability.mine < comparison.durability.theirs}>
                {signed(comparison.durability.mine - comparison.durability.theirs)}
              </dd>
            {/if}

            {#if comparison.weight.mine !== undefined && comparison.weight.theirs !== undefined}
              <dt>{locale.ui_weight || 'Weight'}</dt>
              <!-- Lighter is better, so the tone is inverted against durability's. -->
              <dd class:better={comparison.weight.mine < comparison.weight.theirs}
                  class:worse={comparison.weight.mine > comparison.weight.theirs}>
                {signed((comparison.weight.mine - comparison.weight.theirs) / 1000, 2)}kg
              </dd>
            {/if}

            <dt>{locale.ammo_type}</dt>
            <dd class:better={comparison.sameAmmo}>
              {comparison.sameAmmo ? locale.ui_same_ammo || 'Same' : comparison.ammoLabel}
            </dd>
          </dl>
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .tooltip {
    width: 260px;
    padding: var(--space-2) var(--space-3);
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
    gap: var(--space-2);
    padding-bottom: var(--space-1-5);
    margin-bottom: var(--space-1-5);
    border-bottom: 1px solid var(--color-border);
  }

  .meta.equipped {
    color: var(--color-primary);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    font-size: var(--text-meta);
  }

  /* Set apart from the item's own figures above it: these are differences, and reading a
     delta as an absolute is the one mistake this block can cause. */
  .versus {
    margin-top: var(--space-2);
    padding-top: var(--space-1-5);
    border-top: 1px solid var(--color-border);
  }

  .against {
    margin: 0 0 var(--space-1);
    font-size: var(--text-meta);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .versus dd.better {
    color: var(--color-success);
  }

  .versus dd.worse {
    color: var(--color-danger-text);
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
    margin-bottom: var(--space-1-5);
    color: var(--color-gray);
    font-size: var(--text-sm);
  }

  /* Markdown output is generated, so its elements cannot be reached by scoped styles. */
  .description :global(p + p) {
    margin-top: var(--space-1);
  }
  .description :global(strong) {
    color: var(--color-white);
    font-weight: var(--font-weight-medium);
  }
  .description :global(ul) {
    padding-left: var(--space-4);
    list-style: disc;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-0-5) var(--space-3);
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
    gap: var(--space-1);
  }

  .ingredients li {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    font-size: var(--text-meta);
    color: var(--color-gray);
  }

  .ingredients img {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }
</style>
