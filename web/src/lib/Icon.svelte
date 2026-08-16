<script lang="ts">
  /**
   * Renders Lucide geometry.
   *
   * Deliberately much smaller than ox_lib's and ox_target's equivalents, and deliberately
   * without their lib/icons.ts: this UI receives **no icon names**. Every icon here is
   * chosen in the source and known at build time, so there is nothing to resolve at
   * runtime and no allowlist to maintain.
   *
   * (ox_inventory's Lua does send FontAwesome names — `icon = 'fas fa-dumpster'` and
   * friends — but those are `ox_target:addModel` options. They are rendered by ox_target,
   * which has the map.)
   *
   * This replaces two hand-inlined FontAwesome paths pasted in as literals. Those worked,
   * but they were a third icon dialect on a server that now has one.
   */
  import type { IconNode } from './icons';

  let {
    node,
    size = '1em',
    class: className = '',
  }: { node: IconNode; size?: string; class?: string } = $props();
</script>

<svg
  class={className}
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each node as [tag, attrs], i (i)}
    <svelte:element this={tag} {...attrs} />
  {/each}
</svg>
