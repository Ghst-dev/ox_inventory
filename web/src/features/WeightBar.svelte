<script lang="ts">
  let { percent, durability = false }: { percent: number; durability?: boolean } = $props();

  /**
   * Weight and durability bars.
   *
   * The React version interpolated between three hard-coded flatuicolors RGB triples with
   * a hand-written channel mixer. That is replaced by the theme's semantic colours, which
   * is the whole point of the rebuild — but note the two scales run in opposite
   * directions: a full weight bar is bad, a full durability bar is good.
   *
   * Thresholds are deliberately simple for now. Phase 4 owns the visual pass.
   */
  const clamped = $derived(Math.max(0, Math.min(100, percent)));

  const tone = $derived.by(() => {
    const good = durability ? clamped > 50 : clamped < 50;
    const bad = durability ? clamped < 25 : clamped > 90;

    if (bad) return 'var(--color-danger)';
    if (good) return 'var(--color-success)';
    return 'var(--color-warn)';
  });
</script>

<div class="track" class:slim={durability}>
  <div class="fill" style:width="{clamped}%" style:background={tone} style:visibility={clamped > 0 ? 'visible' : 'hidden'}></div>
</div>

<style>
  .track {
    width: 100%;
    height: 6px;
    background: var(--surface-sunken);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .slim {
    height: 3px;
    border-radius: 0;
  }

  .fill {
    height: 100%;
    transition:
      width var(--dur-slow) var(--ease-out),
      background var(--dur-slow) var(--ease-out);
  }
</style>
