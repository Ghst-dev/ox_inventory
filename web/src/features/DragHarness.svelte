<script lang="ts">
  import { draggable, droppable, drag, isDragging, endDrag } from '../lib/dnd.svelte';
  import type { DragSource, Slot } from '../typings';

  /**
   * Phase 1 only. A hard-coded two-pane grid whose sole job is to prove the drag layer
   * behaves like the react-dnd setup it replaces, with no store, no NUI and no real
   * slot rendering in the way.
   *
   * Deleted in phase 2, when InventorySlot and the real panes take over.
   */

  interface Pane {
    id: string;
    type: string;
    label: string;
    items: Slot[];
    /** Shops and crafting benches are drag sources but never drop targets. */
    acceptsDrops: boolean;
  }

  let panes = $state<Pane[]>([
    {
      id: 'player',
      type: 'player',
      label: 'Player',
      acceptsDrops: true,
      items: [
        { slot: 1, name: 'water', count: 3, weight: 100 },
        { slot: 2, name: 'lockpick', count: 1, weight: 500 },
        { slot: 3 },
        { slot: 4, name: 'burger', count: 2, weight: 220 },
        { slot: 5 },
        { slot: 6 },
      ],
    },
    {
      id: 'stash',
      type: 'container',
      label: 'Stash',
      acceptsDrops: true,
      items: [
        { slot: 1, name: 'medikit', count: 1, weight: 200 },
        { slot: 2 },
        { slot: 3 },
        { slot: 4 },
      ],
    },
    {
      id: 'shop',
      type: 'shop',
      label: 'Shop (drag out only)',
      acceptsDrops: false,
      items: [
        { slot: 1, name: 'bandage', count: 5, weight: 50 },
        { slot: 2, name: 'radio', count: 1, weight: 300 },
      ],
    },
  ]);

  let log = $state<string[]>([]);

  function record(message: string) {
    log = [`${log.length + 1}. ${message}`, ...log].slice(0, 12);
  }

  const hasItem = (slot: Slot) => slot.name !== undefined;

  function sourceFor(pane: Pane, slot: Slot): DragSource | null {
    if (!hasItem(slot)) return null;

    return {
      inventory: pane.type,
      item: { slot: slot.slot, name: slot.name! },
      // Dev only: vite serves web/ as the project root, so web/images is reachable.
      // In game these come from client.imagepath (nui://ox_inventory/web/images).
      image: `url(/images/${slot.name}.png)`,
    };
  }

  function onDrop(pane: Pane, slot: Slot, source: DragSource) {
    const kind = hasItem(slot) ? (slot.name === source.item.name ? 'stack' : 'swap') : 'move';

    record(
      `${kind}: ${source.item.name} from ${source.inventory}[${source.item.slot}] ` +
        `→ ${pane.type}[${slot.slot}]`,
    );
  }

  /**
   * The Use and Give buttons are bare drop targets with no slot of their own —
   * InventoryControl had exactly this, and it is the case a slot-centric drag layer is
   * most likely to get wrong.
   */
  function onAction(action: string, source: DragSource) {
    record(`${action}: ${source.item.name} from ${source.inventory}[${source.item.slot}]`);
  }
</script>

<div class="harness">
  <header>
    <h1>Drag layer</h1>
    <p class="sub">Phase 1 — no store, no NUI</p>
  </header>

  <div class="panes">
    {#each panes as pane (pane.id)}
      <section class="pane" class:inert={!pane.acceptsDrops}>
        <h2>{pane.label}</h2>
        <div class="slots">
          {#each pane.items as slot (slot.slot)}
            <div
              class="slot"
              class:filled={hasItem(slot)}
              class:dragging={isDragging(pane.type, slot.slot)}
              style:background-image={hasItem(slot) ? `url(/images/${slot.name}.png)` : undefined}
              use:draggable={{ source: () => sourceFor(pane, slot) }}
              use:droppable={{
                canDrop: (source) =>
                  pane.acceptsDrops &&
                  !(source.inventory === pane.type && source.item.slot === slot.slot),
                ondrop: (source) => onDrop(pane, slot, source),
              }}
            >
              <span class="num">{slot.slot}</span>
              {#if hasItem(slot)}
                <span class="count">{slot.count}x</span>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>

  <div class="actions">
    <button
      class="action"
      use:droppable={{
        canDrop: (source) => source.inventory === 'player',
        ondrop: (source) => onAction('use', source),
      }}>Use</button
    >
    <button
      class="action"
      use:droppable={{
        canDrop: (source) => source.inventory === 'player',
        ondrop: (source) => onAction('give', source),
      }}>Give</button
    >
    <button class="action" onclick={() => (log = [])}>Clear log</button>
    <button class="action" onclick={endDrag}>endDrag()</button>
  </div>

  <div class="readout">
    <p class="state">
      dragging: <b>{drag.source ? `${drag.source.inventory}[${drag.source.item.slot}]` : 'none'}</b>
      · over: <b>{drag.over ?? 'none'}</b>
    </p>
    <ol class="log">
      {#each log as line (line)}
        <li>{line}</li>
      {/each}
      {#if !log.length}
        <li class="empty">Drag a slot onto another.</li>
      {/if}
    </ol>
  </div>
</div>

<style>
  .harness {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    overflow: auto;
  }

  h1 {
    font-size: var(--text-heading);
    font-weight: var(--font-weight-semibold);
    letter-spacing: var(--tracking-display);
  }

  .sub {
    font-size: var(--text-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-dim);
  }

  .panes {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .pane {
    padding: 12px;
    background: var(--surface-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .pane.inert {
    border-style: dashed;
  }

  h2 {
    margin-bottom: 10px;
    font-size: var(--text-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-gray);
  }

  .slots {
    display: grid;
    grid-template-columns: repeat(3, 72px);
    gap: 6px;
  }

  .slot {
    position: relative;
    height: 72px;
    background-color: var(--surface-sunken);
    background-size: 68%;
    background-position: center;
    background-repeat: no-repeat;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    transition: opacity var(--dur-fast) var(--ease-out);
  }

  .slot.filled {
    cursor: grab;
  }

  .slot.dragging {
    opacity: 0.4;
  }

  /* Set by the droppable action while a valid source is over it. Attribute rather than
     class so the action needs no reactive channel back into the component.

     :global is load-bearing, not decoration. Svelte prunes selectors it cannot see used
     in the markup, and this attribute only ever appears at runtime — without it the rule
     is deleted from the build entirely and hover feedback silently does nothing. */
  .slot:global([data-dnd-over]) {
    border-color: var(--color-primary);
    border-style: dashed;
    background-color: var(--primary-glow);
  }

  .num {
    position: absolute;
    top: 3px;
    left: 5px;
    font-size: var(--text-meta);
    color: var(--color-dim);
  }

  .count {
    position: absolute;
    top: 3px;
    right: 5px;
    font-size: var(--text-meta);
    color: var(--color-gray);
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .action {
    padding: 8px 14px;
    background: var(--surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-gray);
    font-size: var(--text-sm);
  }

  .action:global([data-dnd-over]) {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--primary-glow);
  }

  .readout {
    padding: 12px 14px;
    background: var(--surface-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .state {
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-gray);
  }

  .state b {
    color: var(--color-primary);
    font-weight: var(--font-weight-medium);
  }

  .log {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: var(--font-mono);
    font-size: var(--text-meta);
    color: var(--color-gray);
  }

  .log .empty {
    color: var(--color-dim);
  }
</style>
