/**
 * Pointer-based drag and drop, replacing react-dnd.
 *
 * The API surface the inventory actually used was small — `isDragging`, `isOver`,
 * `canDrag`, `canDrop`, `drop`, and one imperative cancel — so this reimplements those
 * rather than pulling in a general-purpose library.
 *
 * Everything runs on pointer events, which is why there is no separate touch path: the
 * React build needed react-dnd-touch-backend alongside the HTML5 backend, and pointer
 * events cover mouse, touch and pen with the same handlers.
 *
 * HIT TESTING. Hovering is resolved with elementFromPoint on every move rather than with
 * pointerenter/pointerleave on the drop targets. Enter and leave would be less work, but
 * the browser implicitly captures a *touch* pointer to the element where it went down,
 * so those events never fire on anything else and dragging by touch silently does
 * nothing. Move events still bubble to the window under capture, so this way works for
 * every pointer type.
 *
 * POSITION. The preview node is written to directly, never through $state. It has to
 * track the cursor 1:1, and routing a pointermove through the reactive graph to a style
 * attribute puts it a frame behind. The React implementation avoided this the same way,
 * with useLayoutEffect and a direct style write.
 */

import { play } from './audio';
import type { DragSource, DropTarget } from '../typings';

/** Movement in px before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 5;

/**
 * The release itself: where the pointer was and which modifiers were down.
 *
 * Read at release rather than tracked while the drag runs. A drag can start before the
 * key is pressed and the key can be let go before the pointer is, so the only moment
 * that unambiguously expresses intent is the release — which is also the moment the
 * pointerup event hands all of this over for free.
 *
 * The coordinates are here rather than fetched from the module's last-known position
 * because a drop handler that wants to open something at the cursor should not have to
 * ask a second question to find out where the cursor was.
 */
export interface DropRelease {
  alt: boolean;
  ctrl: boolean;
  shift: boolean;
  x: number;
  y: number;
}

const NO_RELEASE: DropRelease = { alt: false, ctrl: false, shift: false, x: 0, y: 0 };

interface Droppable {
  /** Reject a source before it can be dropped. Mirrors react-dnd's canDrop. */
  canDrop?: (source: DragSource) => boolean;
  ondrop: (source: DragSource, release: DropRelease) => void;
}

const droppables = new Map<string, Droppable>();
let nextId = 0;

/** The node the preview renders into, positioned imperatively during a drag. */
let previewEl: HTMLElement | null = null;

/**
 * Live drag state. Read `source` to dim the slot being dragged; `over` is exposed mainly
 * for debugging, since drop targets style themselves through the data-dnd-over attribute
 * the action sets.
 */
export const drag = $state<{
  source: DragSource | null;
  over: string | null;
  /** The target under the cursor that has refused this item, if any. */
  deny: string | null;
}>({
  source: null,
  over: null,
  deny: null,
});

/** True while the given slot is the one being dragged. */
export function isDragging(inventory: string, slot: number): boolean {
  return drag.source?.inventory === inventory && drag.source.item.slot === slot;
}

/** Called by DragPreview so the move handler can position it without a re-render. */
export function setPreviewElement(el: HTMLElement | null): void {
  previewEl = el;
  if (el) movePreview(lastX, lastY);
}

let lastX = 0;
let lastY = 0;

function movePreview(x: number, y: number): void {
  lastX = x;
  lastY = y;
  if (previewEl) previewEl.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
}

/**
 * What is under the cursor, and whether it would take the item.
 *
 * The refused case used to collapse into "nothing here": canDrop returning false made
 * this return null, so hovering a slot that would reject the drop looked exactly like
 * hovering the gap between two slots. It is now reported separately so it can be said
 * out loud — a refusal the player can see is the whole point of testing before release.
 */
function hitTest(x: number, y: number): { id: string; allowed: boolean } | null {
  const el = document.elementFromPoint(x, y);
  const target = el?.closest<HTMLElement>('[data-dnd-drop]');
  const id = target?.dataset.dndDrop;

  if (!id || !drag.source) return null;

  const droppable = droppables.get(id);
  if (!droppable) return null;

  return { id, allowed: !droppable.canDrop || droppable.canDrop(drag.source) };
}

/** Flip one boolean attribute on the node backing a droppable id. */
function mark(id: string | null, attr: string, on: boolean): void {
  if (!id) return;

  const node = document.querySelector<HTMLElement>(`[data-dnd-drop="${id}"]`);
  if (on) node?.setAttribute(attr, '');
  else node?.removeAttribute(attr);
}

function setOver(hit: { id: string; allowed: boolean } | null): void {
  const id = hit?.allowed ? hit.id : null;
  const denied = hit && !hit.allowed ? hit.id : null;

  if (drag.over !== id) {
    mark(drag.over, 'data-dnd-over', false);
    drag.over = id;
    mark(id, 'data-dnd-over', true);
  }

  if (drag.deny !== denied) {
    mark(drag.deny, 'data-dnd-deny', false);
    drag.deny = denied;
    mark(denied, 'data-dnd-deny', true);
  }
}

/**
 * Mark every target that would accept the item being dragged, once, at drag start.
 *
 * Deliberately not recomputed on move: canDrop is cheap but there are sixty-odd
 * droppables on screen and a pointermove fires every frame. The release-time re-check in
 * finishDrag is what guards correctness if state shifts mid-drag; this is only a hint.
 *
 * Every accepting target gets the attribute, but almost nothing styles it — lighting up
 * thirty empty slots while you drag across your own inventory is noise. It exists for the
 * targets a player would not otherwise know were targets at all, which is Use and Give.
 */
function markAcceptingTargets(on: boolean): void {
  for (const [id, droppable] of droppables) {
    const accepts = on && drag.source && (!droppable.canDrop || droppable.canDrop(drag.source));
    mark(id, 'data-dnd-ok', !!accepts);
  }
}

/**
 * Abandon the current drag without dropping.
 *
 * The React build reached for `manager.dispatch({ type: 'dnd-core/END_DRAG' })` in two
 * places: when the inventory closes, and when a refreshSlots message rewrites the slot
 * currently under the cursor. In the second case the item being dragged may no longer
 * exist, so finishing the drag would act on a stale slot.
 */
export function endDrag(): void {
  if (!drag.source) return;

  setOver(null);
  markAcceptingTargets(false);
  drag.source = null;
  document.body.classList.remove('inv-dragging');
}

function finishDrag(commit: boolean, release: DropRelease = NO_RELEASE): void {
  const source = drag.source;
  const overId = drag.over;

  if (commit && source && overId) {
    const droppable = droppables.get(overId);
    // Re-check canDrop at release: the pointer has not moved, but state may have
    // changed under it since the last hit test.
    if (droppable && (!droppable.canDrop || droppable.canDrop(source)))
      droppable.ondrop(source, release);
    // Refused between the last hit test and the release. Silent otherwise, which reads as
    // the drag having not registered at all.
    else play('deny');
  }

  endDrag();
}

export interface DraggableOptions {
  /**
   * The payload, resolved when the drag actually starts rather than when the action is
   * created — the slot's contents may have changed by then. Returning null refuses the
   * drag, which is how an empty slot opts out.
   */
  source: () => DragSource | null;
  canDrag?: () => boolean;
}

/**
 * Make a node draggable. `use:draggable={{ source, canDrag }}`
 *
 * Nothing happens until the pointer has moved DRAG_THRESHOLD px. Below that the press is
 * left alone to become a click, which matters because ctrl+click and alt+click are
 * separate actions on a slot (quick-move and use).
 */
export function draggable(node: HTMLElement, options: DraggableOptions) {
  let opts = options;
  let startX = 0;
  let startY = 0;
  let pending = false;

  function onPointerDown(event: PointerEvent) {
    // Primary button only. Right-click belongs to the context menu, and middle-click
    // should not start anything.
    if (event.button !== 0) return;
    if (opts.canDrag && !opts.canDrag()) return;

    startX = event.clientX;
    startY = event.clientY;
    pending = true;

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('keydown', onKeyDown);
  }

  function onPointerMove(event: PointerEvent) {
    if (pending) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_THRESHOLD) return;

      const source = opts.source();
      if (!source) return teardown();

      pending = false;
      drag.source = source;
      document.body.classList.add('inv-dragging');
      markAcceptingTargets(true);
      play('pickup');
    }

    movePreview(event.clientX, event.clientY);
    setOver(hitTest(event.clientX, event.clientY));
  }

  function onPointerUp(event: PointerEvent) {
    const wasDragging = !pending;
    teardown();

    if (wasDragging)
      finishDrag(true, {
        alt: event.altKey,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        x: event.clientX,
        y: event.clientY,
      });
  }

  function onPointerCancel() {
    teardown();
    finishDrag(false);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    teardown();
    finishDrag(false);
  }

  function teardown() {
    pending = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('keydown', onKeyDown);
  }

  node.addEventListener('pointerdown', onPointerDown);

  return {
    update(next: DraggableOptions) {
      opts = next;
    },
    destroy() {
      teardown();
      node.removeEventListener('pointerdown', onPointerDown);
    },
  };
}

/**
 * Make a node a drop target. `use:droppable={{ canDrop, ondrop }}`
 *
 * While a valid source is over it the node carries a `data-dnd-over` attribute, so
 * hover styling is pure CSS and needs no reactive plumbing back into the component.
 */
export function droppable(node: HTMLElement, options: Droppable) {
  const id = `d${nextId++}`;

  droppables.set(id, options);
  node.dataset.dndDrop = id;

  return {
    update(next: Droppable) {
      droppables.set(id, next);
    },
    destroy() {
      if (drag.over === id || drag.deny === id) setOver(null);
      droppables.delete(id);
      delete node.dataset.dndDrop;
    },
  };
}

/**
 * Suppress the browser's own drag behaviour. Slots are painted with background images
 * and the native image drag would otherwise start its own ghost alongside ours.
 * App.tsx did this at module scope; it belongs with the rest of the drag handling.
 */
export function suppressNativeDrag(): () => void {
  const handler = (event: Event) => event.preventDefault();
  window.addEventListener('dragstart', handler);
  return () => window.removeEventListener('dragstart', handler);
}

export type { DragSource, DropTarget };
