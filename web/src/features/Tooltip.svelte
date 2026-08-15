<script lang="ts">
  import { fade } from 'svelte/transition';
  import { anchored } from '../lib/position';
  import { tooltip } from '../lib/ui.svelte';
  import SlotTooltip from './SlotTooltip.svelte';
</script>

{#if tooltip.item && tooltip.inventoryType && tooltip.anchor}
  <!-- Fixed and outside the pane on purpose: a scroll container clips both axes
       whatever overflow-x says, so a tooltip rendered inside the slot grid would be cut
       off at the pane edge. -->
  <div
    class="floating"
    use:anchored={{ anchor: tooltip.anchor, options: { side: 'right', gap: 10 } }}
    transition:fade={{ duration: 120 }}
  >
    <SlotTooltip item={tooltip.item} inventoryType={tooltip.inventoryType} />
  </div>
{/if}

<style>
  .floating {
    position: fixed;
    z-index: 60;
    pointer-events: none;
  }
</style>
