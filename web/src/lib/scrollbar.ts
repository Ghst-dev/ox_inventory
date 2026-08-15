/**
 * Measure how much width a scrolling grid actually loses to its scrollbar, and publish
 * it as --grid-scrollbar.
 *
 * The pane's width has to account for the scrollbar exactly: too little and the fifth
 * column is clipped, too much and there is visible dead space down the right-hand side
 * that the left does not have. Neither is guessable — how much a scrolling container
 * takes depends on whether the client honours the styled ::-webkit-scrollbar width, and
 * it does not always.
 *
 * So measure it against the real stylesheet rather than assume. The probe carries the
 * same class the grids do, so whatever rule applies to them applies to it.
 */

const FALLBACK = 6;

export function publishScrollbarWidth(): number {
  const probe = document.createElement('div');

  probe.className = 'slot-grid';
  probe.style.cssText =
    'position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow-y:scroll;';

  document.body.appendChild(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();

  // A zero reading means overlay scrollbars, which take no layout width at all — that
  // is a legitimate answer, so only a negative or absurd one falls back.
  const resolved = width >= 0 && width < 40 ? width : FALLBACK;

  document.documentElement.style.setProperty('--grid-scrollbar', `${resolved}px`);

  return resolved;
}
