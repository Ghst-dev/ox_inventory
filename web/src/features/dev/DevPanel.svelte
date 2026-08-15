<script lang="ts">
  import { debugData } from '../../lib/nui';
  import { nuiMocks } from '../../lib/mocks';
  import { inv } from '../../lib/inventory.svelte';
  import * as fixtures from './fixtures';

  /**
   * Browser-only harness. App.svelte mounts it behind isEnvBrowser(), so it is never
   * present in game — but nothing here reaches past debugData and the mock table, so a
   * mistake could not affect the real UI even if it were.
   *
   * A two-pane inventory is miserable to iterate on in the game: every change means a
   * resource restart, walking to a stash, and setting up whatever state you were
   * looking at. This exists so that none of that is necessary until the end.
   */

  let open = $state(false);

  const DRAWER_WIDTH = 220;

  /**
   * Re-centre the inventory in the space beside the drawer while it is open.
   *
   * Applied as padding-left on the wrapper, which fills the viewport and centres its
   * contents — so padding of the drawer's full width is what turns "centred in the
   * viewport" into "centred in what is left of it".
   *
   * Not cosmetic. The drag layer resolves drops with elementFromPoint, so any slot the
   * drawer covers stops being a drop target — dragging onto the first column silently
   * does nothing, which is a miserable thing to debug in the harness you built to make
   * debugging easier. Measured at 1280x800: without this the first slot's centre hit
   * the drawer, with it the slot.
   *
   * It is tight at that width — the two panes plus the control column are nearly as
   * wide as the remaining space. Nothing breaks, but do not narrow the gap further.
   */
  $effect(() => {
    document.documentElement.style.setProperty('--dev-shift', open ? `${DRAWER_WIDTH}px` : '0px');
    return () => document.documentElement.style.removeProperty('--dev-shift');
  });

  const send = (action: string, data?: unknown) => debugData([{ action, data }], 0);

  const openWith = (right: unknown) =>
    send('setupInventory', { leftInventory: fixtures.player, rightInventory: right });

  /* ---- server behaviour switches ------------------------------------------ */

  // These change what the *mocked server* does, which is the only way to reach the
  // rollback and in-flight paths from a browser: both need the server to answer
  // something other than an immediate yes.
  let reject = $state(false);
  let slow = $state(false);

  $effect(() => {
    const answer = !reject;

    nuiMocks.swapItems = slow
      ? () => new Promise((resolve) => setTimeout(() => resolve(answer), 1200))
      : answer;

    nuiMocks.buyItem = answer;
  });

  /* ---- refreshSlots -------------------------------------------------------- */

  // The server pushing a change into a slot the UI is not expecting. Also the path that
  // cancels a drag whose source it rewrites.
  const pushItem = () =>
    send('refreshSlots', {
      items: [{ item: { slot: 1, name: 'scrapmetal', count: 9, weight: 900 }, inventory: 'player' }],
    });

  const clearSlot = () =>
    send('refreshSlots', { items: [{ item: { slot: 1 }, inventory: 'player' }] });

  // SetMaxWeight and slot-count changes while an inventory is open. The second rebuilds
  // the pane, since the dense slot array is sized by it.
  const shrinkWeight = () =>
    send('refreshSlots', { weightData: { inventoryId: 'test', maxWeight: 8000 } });

  const growSlots = () =>
    send('refreshSlots', { slotsData: { inventoryId: 'stash1', slots: 60 } });

  /* ---- notifications ------------------------------------------------------- */

  // `text` is a locale key, not a string — client.lua sends 'ui_added' and the UI
  // resolves it.
  const notifyAdd = () =>
    send('itemNotify', [{ slot: 1, name: 'water', count: 3, weight: 300 }, 'ui_added', 3]);

  const notifyRemove = () =>
    send('itemNotify', [{ slot: 3, name: 'lockpick', count: 1, weight: 500 }, 'ui_removed']);

  /** Extra tooltip rows the server registers for its own metadata fields. */
  const metadata = () =>
    send('displayMetadata', [
      { metadata: 'serial', value: 'Registration' },
      { metadata: 'type', value: 'Class' },
    ]);

  const GROUPS: Array<[string, Array<[string, () => void]>]> = [
    [
      'Open',
      [
        ['Stash', () => openWith(fixtures.stash)],
        ['Shop', () => openWith(fixtures.shop)],
        ['Crafting bench', () => openWith(fixtures.crafting)],
        ['Container', () => openWith(fixtures.container)],
        ['Player only', () => send('setupInventory', { leftInventory: fixtures.player })],
        ['Close', () => send('closeInventory')],
      ],
    ],
    [
      'Server pushes',
      [
        ['Fill slot 1', pushItem],
        ['Empty slot 1', clearSlot],
        ['Max weight → 8kg', shrinkWeight],
        ['Stash → 60 slots', growSlots],
        ['Extra metadata', metadata],
      ],
    ],
    [
      'Elsewhere',
      [
        ['Hotbar', () => send('toggleHotbar')],
        ['Notify added', notifyAdd],
        ['Notify removed', notifyRemove],
      ],
    ],
  ];
</script>

<button class="launcher" onclick={() => (open = !open)} title="Developer drawer">DEV</button>

{#if open}
  <aside class="drawer">
    <h2>Developer drawer</h2>

    {#each GROUPS as [heading, actions] (heading)}
      <h3>{heading}</h3>
      {#each actions as [label, run] (label)}
        <button class="action" onclick={run}>{label}</button>
      {/each}
    {/each}

    <h3>Server answers</h3>
    <label class="toggle">
      <input type="checkbox" bind:checked={reject} />
      <span>Refuse moves <em>(rollback)</em></span>
    </label>
    <label class="toggle">
      <input type="checkbox" bind:checked={slow} />
      <span>Delay 1200ms <em>(isBusy)</em></span>
    </label>

    <p class="state">
      busy <b>{inv.isBusy ? 'yes' : 'no'}</b> · amount <b>{inv.itemAmount}</b> · shift
      <b>{inv.shiftPressed ? 'down' : 'up'}</b>
    </p>

    <p class="note">Browser only — never mounted in game.</p>
  </aside>
{/if}

<style>
  .launcher {
    position: absolute;
    right: 20px;
    top: 20px;
    padding: 8px 12px;
    border-radius: var(--radius-full);
    background: var(--color-warn);
    color: var(--color-bg);
    font-size: var(--text-meta);
    font-weight: 700;
    letter-spacing: var(--tracking-label);
    z-index: 100;
  }

  .drawer {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 220px;
    padding: 16px;
    overflow-y: auto;
    background: var(--surface-panel);
    border-right: 1px solid var(--color-border);
    z-index: 100;
  }

  h2 {
    font-size: var(--text-sm);
    font-weight: var(--font-weight-semibold);
    margin-bottom: 6px;
  }

  h3 {
    margin-top: 10px;
    font-size: var(--text-meta);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-dim);
  }

  .action {
    width: 100%;
    padding: 6px 10px;
    text-align: left;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-white);
    font-size: var(--text-sm);
  }
  .action:hover {
    border-color: var(--primary-glow-border);
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 2px;
    font-size: var(--text-sm);
    color: var(--color-gray);
  }

  .toggle em {
    font-style: normal;
    color: var(--color-dim);
  }

  .state {
    margin-top: 10px;
    font-family: var(--font-mono);
    font-size: var(--text-meta);
    color: var(--color-dim);
  }

  .state b {
    color: var(--color-primary);
    font-weight: var(--font-weight-regular);
  }

  .note {
    margin-top: auto;
    padding-top: 12px;
    font-size: var(--text-meta);
    color: var(--color-dim);
  }
</style>
