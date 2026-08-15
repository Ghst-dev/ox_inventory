<script lang="ts">
  import { drag, setPreviewElement } from '../lib/dnd.svelte';

  /**
   * The item that follows the cursor during a drag.
   *
   * Positioned by dnd.svelte.ts writing to this node directly — see the note there about
   * why the transform never goes through $state. This component only decides whether the
   * node exists and what image it carries.
   */

  let el = $state<HTMLElement | null>(null);

  $effect(() => {
    setPreviewElement(el);
    return () => setPreviewElement(null);
  });
</script>

{#if drag.source}
  <div class="preview item-art" bind:this={el} style:background-image={drag.source.image}></div>
{/if}

<style>
  .preview {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;
    width: var(--slot-size);
    height: var(--slot-size);
    background-color: var(--surface-raised);
    background-size: 70%;
    background-position: center;
    background-repeat: no-repeat;
    border: 1px solid var(--primary-glow-border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-raised);
    opacity: 0.85;

    /* Must not be hit-testable: elementFromPoint runs on every move and would otherwise
       find the preview sitting under the cursor instead of the slot beneath it. */
    pointer-events: none;

    /* Promoted to its own layer. The transform is rewritten on every pointermove, and
       without these the compositor repaints the element instead of just moving it,
       which is visible as the preview lagging the cursor across a busy grid. */
    will-change: transform;
    backface-visibility: hidden;
  }
</style>
