<script lang="ts">
  import { onDrop, onGive, onUse } from '../lib/actions';
  import { fetchNui } from '../lib/nui';
  import { anchored } from '../lib/position';
  import { items as itemDefs, locale } from '../lib/state.svelte';
  import { closeContextMenu, contextMenu, openWeaponPanel } from '../lib/ui.svelte';
  import { setClipboard } from '../utils/setClipboard';
  import { InventoryType } from '../typings';

  /**
   * Right-click menu for a player-inventory slot.
   *
   * Replaces the floating-ui Menu primitive, which brought focus management, typeahead,
   * list navigation and safe-polygon hover with it. None of that is reachable here: the
   * menu is opened by right-click, dismissed by clicking away, and has exactly one level
   * of nesting (attachments, and any grouped buttons an item declares).
   */

  interface Entry {
    label: string;
    run?: () => void;
    children?: Entry[];
  }

  const item = $derived(contextMenu.item);

  /**
   * Items can declare their own buttons in Lua, optionally tagged with a `group`. Runs of
   * buttons sharing a group collapse into one submenu; ungrouped ones stay inline. The
   * index is the button's position in the original array, which is what `useButton`
   * expects — so it has to be captured before any grouping rearranges them.
   */
  function itemButtons(): Entry[] {
    const buttons = (item?.name ? itemDefs[item.name]?.buttons : undefined) as
      | Array<{ label: string; group?: string }>
      | undefined;

    if (!buttons?.length) return [];

    const out: Entry[] = [];
    const groups = new Map<string, Entry>();

    buttons.forEach((button, index) => {
      const entry: Entry = {
        label: button.label,
        run: () => fetchNui('useButton', { id: index + 1, slot: item!.slot }),
      };

      if (!button.group) return void out.push(entry);

      let group = groups.get(button.group);

      if (!group) {
        group = { label: button.group, children: [] };
        groups.set(button.group, group);
        out.push(group);
      }

      group.children!.push(entry);
    });

    return out;
  }

  const entries = $derived.by<Entry[]>(() => {
    if (!item) return [];

    const list: Entry[] = [
      { label: locale.ui_use || 'Use', run: () => onUse(item) },
      { label: locale.ui_give || 'Give', run: () => onGive(item) },
      {
        label: locale.ui_drop || 'Drop',
        run: () => onDrop({ inventory: InventoryType.PLAYER, item: { name: item.name, slot: item.slot } }),
      },
    ];

    if (item.metadata?.ammo > 0) {
      list.push({
        label: locale.ui_remove_ammo,
        run: () => fetchNui('removeAmmo', item.slot),
      });
    }

    if (item.metadata?.serial) {
      list.push({
        label: locale.ui_copy,
        run: () => setClipboard(item.metadata?.serial || ''),
      });
    }

    /**
     * A weapon gets a panel instead of a submenu.
     *
     * Recognised by any of the three things only weapons carry: a serial, a components
     * array, or an ammo type on the definition. `components` alone would miss a gun with
     * nothing bolted to it, which is exactly the one whose panel is worth opening to see
     * that it has empty hands.
     */
    const isWeapon =
      item.metadata?.serial !== undefined ||
      item.metadata?.components !== undefined ||
      itemDefs[item.name]?.ammoName !== undefined;

    if (isWeapon) {
      list.push({
        label: locale.ui_attachments || 'Attachments',
        run: () => openWeaponPanel(item.slot),
      });
    }

    return [...list, ...itemButtons()];
  });

  let openSubmenu = $state<string | null>(null);
  let submenuAnchor = $state<DOMRect | null>(null);

  function activate(entry: Entry) {
    if (entry.children) return;

    entry.run?.();
    closeContextMenu();
  }

  function hover(entry: Entry, event: MouseEvent) {
    if (!entry.children) {
      openSubmenu = null;
      return;
    }

    openSubmenu = entry.label;
    submenuAnchor = (event.currentTarget as HTMLElement).getBoundingClientRect();
  }

  const submenu = $derived(entries.find((entry) => entry.label === openSubmenu));

  /**
   * Dismiss on any press outside the menu. Registered on pointerdown rather than click so
   * the menu is gone before a drag can start underneath it.
   */
  function onPointerDown(event: PointerEvent) {
    const target = event.target;

    // Not always an Element — a press that lands on the document itself has no closest().
    if (!(target instanceof Element) || !target.closest('.menu')) closeContextMenu();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') closeContextMenu();
  }
</script>

<svelte:window onpointerdown={onPointerDown} onkeydown={onKeyDown} />

{#if item && contextMenu.anchor}
  <div class="menu" use:anchored={{ anchor: contextMenu.anchor, options: { side: 'point', gap: 0 } }}>
    {#each entries as entry (entry.label)}
      <button
        class="entry"
        class:parent={!!entry.children}
        class:active={openSubmenu === entry.label}
        onmouseenter={(event) => hover(entry, event)}
        onclick={() => activate(entry)}
      >
        <span>{entry.label}</span>
        {#if entry.children}<span class="chevron">›</span>{/if}
      </button>
    {/each}
  </div>

  {#if submenu?.children && submenuAnchor}
    <div
      class="menu submenu"
      use:anchored={{ anchor: submenuAnchor, options: { side: 'right', gap: 2 } }}
      onmouseleave={() => (openSubmenu = null)}
      role="menu"
      tabindex="-1"
    >
      {#each submenu.children as child (child.label)}
        <button class="entry" onclick={() => activate(child)}>{child.label}</button>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .menu {
    position: fixed;
    z-index: 80;
    display: flex;
    flex-direction: column;
    min-width: 160px;
    padding: 4px;
    background: var(--surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: inset 0 1px 0 var(--edge-highlight), var(--shadow-panel);
  }

  .entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    color: var(--color-gray);
    font-size: var(--text-sm);
    text-align: left;
    white-space: nowrap;
  }

  /* Neutral lift rather than a hue wash — the shared hover convention, see tokens.css. */
  .entry:hover,
  .entry.active {
    background: var(--color-surface-2);
    color: var(--color-white);
  }

  .chevron {
    color: var(--color-dim);
  }

  /* The gap between a parent entry and its submenu is only 2px, but the pointer still
     crosses it. Widening the submenu's hit area upward stops the menu closing when the
     cursor clips the corner — the cheap half of what floating-ui's safePolygon did. */
  .submenu {
    padding-top: 6px;
    margin-top: -4px;
  }
</style>
