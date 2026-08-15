<script lang="ts">
  import { tick } from 'svelte';
  import { onGive, onUse } from '../lib/actions';
  import { droppable } from '../lib/dnd.svelte';
  import { inv } from '../lib/inventory.svelte';
  import { fetchNui } from '../lib/nui';
  import { locale } from '../lib/state.svelte';
  import { InventoryType, type DragSource } from '../typings';
  import UsefulControls from './UsefulControls.svelte';

  /**
   * The centre column: how many of a thing to move, and the three verbs.
   *
   * Use and Give are drop targets rather than buttons you press with a slot selected —
   * you drag an item onto them. They are also the only interactive surface outside the
   * grid, which is why the store's concurrency guard cannot rely on the grid's
   * pointer-events being switched off.
   */

  let helpOpen = $state(false);
  let input = $state<HTMLInputElement | null>(null);

  /**
   * The amount box is formatted with thousands separators as you type, which means the
   * caret has to be restored by hand after every edit — replacing the value moves it to
   * the end. The trick, carried over from the React build, is to count *digits* before
   * the caret rather than characters, then map that back to a character offset once the
   * new string exists. Separators shift, digits do not.
   */
  const formatAmount = (n: number) => (n > 0 ? n.toLocaleString('en-US') : '0');
  const digitsOnly = (s: string) => s.replace(/\D/g, '');
  const countDigitsBefore = (s: string, index: number) => digitsOnly(s.substring(0, index)).length;

  let value = $state(formatAmount(inv.itemAmount));

  async function commitValue(raw: string, cursorIndex: number) {
    const digitsBefore = countDigitsBefore(raw, cursorIndex);
    const parsed = parseInt(digitsOnly(raw), 10) || 0;

    value = formatAmount(parsed);
    inv.itemAmount = parsed;

    await tick();
    if (!input) return;

    let position = 0;
    let seen = 0;

    for (let i = 0; i < value.length && seen < digitsBefore; i++) {
      if (/\d/.test(value[i])) seen++;
      position++;
    }

    input.setSelectionRange(position, position);
  }

  function oninput(event: Event) {
    const el = event.currentTarget as HTMLInputElement;
    commitValue(el.value, el.selectionStart ?? 0);
  }

  /**
   * Backspace and Delete against a separator would otherwise do nothing visible — the
   * comma is removed and immediately re-derived. Eat the digit beside it instead.
   */
  function onkeydown(event: KeyboardEvent) {
    const el = event.currentTarget as HTMLInputElement;
    const pos = el.selectionStart ?? 0;

    if (pos !== el.selectionEnd) return;

    if (event.key === 'Backspace' && el.value[pos - 1] === ',') {
      event.preventDefault();
      commitValue(el.value.slice(0, pos - 2) + el.value.slice(pos), pos - 2);
    } else if (event.key === 'Delete' && el.value[pos] === ',') {
      event.preventDefault();
      commitValue(el.value.slice(0, pos) + el.value.slice(pos + 2), pos);
    }
  }

  const fromPlayer = (source: DragSource) => source.inventory === InventoryType.PLAYER;
</script>

<UsefulControls bind:open={helpOpen} />

<div class="control">
  <input
    class="amount"
    type="text"
    inputmode="numeric"
    bind:this={input}
    {value}
    {oninput}
    {onkeydown}
    aria-label="Item amount"
  />

  <button
    class="verb"
    use:droppable={{ canDrop: fromPlayer, ondrop: (source) => onUse(source.item) }}
  >
    {locale.ui_use || 'Use'}
  </button>

  <button
    class="verb"
    use:droppable={{ canDrop: fromPlayer, ondrop: (source) => onGive(source.item) }}
  >
    {locale.ui_give || 'Give'}
  </button>

  <button class="verb" onclick={() => fetchNui('exit')}>{locale.ui_close || 'Close'}</button>

  <button class="help" onclick={() => (helpOpen = true)} aria-label={locale.ui_usefulcontrols}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"
      />
    </svg>
  </button>
</div>

<style>
  .control {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 150px;
    padding-top: 34px;
  }

  .amount {
    width: 100%;
    padding: 8px 10px;
    background: var(--surface-sunken);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-white);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    text-align: center;
  }

  .amount:focus {
    border-color: var(--primary-glow-border);
    outline: none;
    box-shadow: var(--ring-accent);
  }

  .verb {
    padding: 9px 12px;
    background: var(--surface-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-gray);
    font-size: var(--text-sm);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .verb:hover {
    border-color: var(--primary-glow-border);
    color: var(--color-white);
  }

  /* Set by the droppable action at runtime, so :global keeps Svelte from pruning it. */
  .verb:global([data-dnd-over]) {
    /* Tint over the button's surface, not in place of it — see tokens.css. */
    background: color-mix(in srgb, var(--color-primary) 14%, var(--surface-panel));
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .help {
    align-self: center;
    margin-top: 4px;
    padding: 6px;
    color: var(--color-dim);
    border-radius: var(--radius-full);
  }

  .help:hover {
    color: var(--color-primary);
  }
</style>
