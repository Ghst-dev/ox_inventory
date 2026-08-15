/**
 * Viewport-aware placement for floating surfaces, replacing @floating-ui/react.
 *
 * The React build pulled in the whole floating-ui React binding for three things: the
 * item tooltip, the right-click menu and its one level of submenus. That package brings
 * an interaction layer with it — focus management, typeahead, list navigation, safe
 * polygons — none of which a right-click menu in a game overlay needs.
 *
 * This is the same measured-rect approach used for ox_lib's popovers: measure the
 * floating element, decide a side, clamp to the viewport. Everything is `position:
 * fixed`, which also sidesteps the clipping problem — a scroll container clips both
 * axes regardless of `overflow-x: visible`, so a tooltip anchored inside the slot grid
 * would be cut off at the pane edge.
 */

export interface Placement {
  x: number;
  y: number;
}

interface AnchorOptions {
  /** Gap between the anchor and the floating element. */
  gap?: number;
  /** Keep this far from the viewport edge. */
  margin?: number;
  /**
   * Preferred side. 'right' is used for tooltips and submenus, which flip to the left
   * when there is no room; 'point' places at an exact coordinate (the right-click menu).
   */
  side?: 'right' | 'point';
}

/**
 * Place `floating` next to `anchor`, flipping and clamping so it stays on screen.
 *
 * Both rects are viewport coordinates, so the result is directly usable as fixed
 * position. The floating element must already be measurable — call this after it is in
 * the DOM, not before.
 */
export function place(
  anchor: { top: number; left: number; right: number; bottom: number },
  floating: { width: number; height: number },
  { gap = 10, margin = 8, side = 'right' }: AnchorOptions = {},
): Placement {
  let x: number;

  if (side === 'point') {
    x = anchor.left;
    // A menu opened near the right edge opens leftwards instead of being shoved back
    // under the cursor, which would put the first item under the pointer.
    if (x + floating.width + margin > window.innerWidth) x = anchor.left - floating.width;
  } else {
    x = anchor.right + gap;
    if (x + floating.width + margin > window.innerWidth) x = anchor.left - floating.width - gap;
  }

  let y = side === 'point' ? anchor.top : anchor.top;

  // Vertical clamping rather than flipping: a tooltip that jumps above the cursor when
  // it happens to be tall is more disorienting than one that slides up a little.
  if (y + floating.height + margin > window.innerHeight) {
    y = window.innerHeight - floating.height - margin;
  }

  return {
    x: Math.max(margin, Math.min(x, window.innerWidth - floating.width - margin)),
    y: Math.max(margin, y),
  };
}

/**
 * Svelte action: position a fixed element against an anchor rect, re-measuring whenever
 * the anchor changes.
 *
 * Measured synchronously, deliberately. The obvious implementation defers to a
 * requestAnimationFrame so the element has "finished rendering" — but the action already
 * runs after the node and its children are in the document, and getBoundingClientRect
 * forces the layout it needs. Waiting for a frame buys nothing and costs two things: one
 * frame of the element sitting unpositioned, and a hard dependency on rAF actually
 * firing. The second one bites — a throttled or non-compositing page stops delivering
 * frames, and the menu then simply never moves off 0,0.
 */
export function anchored(
  node: HTMLElement,
  params: { anchor: DOMRect | null; options?: AnchorOptions },
) {
  function apply(current: { anchor: DOMRect | null; options?: AnchorOptions }) {
    if (!current.anchor) {
      node.style.visibility = 'hidden';
      return;
    }

    const { x, y } = place(current.anchor, node.getBoundingClientRect(), current.options);

    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.visibility = 'visible';
  }

  apply(params);

  return {
    update: apply,
  };
}
