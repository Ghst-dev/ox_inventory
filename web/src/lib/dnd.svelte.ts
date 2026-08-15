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

import type { DragSource, DropTarget } from '../typings';

/** Movement in px before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 5;

interface Droppable {
  /** Reject a source before it can be dropped. Mirrors react-dnd's canDrop. */
  canDrop?: (source: DragSource) => boolean;
  ondrop: (source: DragSource) => void;
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
export const drag = $state<{ source: DragSource | null; over: string | null }>({
  source: null,
  over: null,
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

function hitTest(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  const target = el?.closest<HTMLElement>('[data-dnd-drop]');
  const id = target?.dataset.dndDrop;

  if (!id || !drag.source) return null;

  const droppable = droppables.get(id);
  if (!droppable) return null;

  // canDrop rejects before hover, so a target that cannot take this item never lights
  // up — react-dnd behaved the same way, and it is the only feedback that a move is
  // disallowed before you commit to it.
  if (droppable.canDrop && !droppable.canDrop(drag.source)) return null;

  return id;
}

function setOver(id: string | null): void {
  if (drag.over === id) return;

  if (drag.over) {
    document
      .querySelector<HTMLElement>(`[data-dnd-drop="${drag.over}"]`)
      ?.removeAttribute('data-dnd-over');
  }

  drag.over = id;

  if (id) {
    document.querySelector<HTMLElement>(`[data-dnd-drop="${id}"]`)?.setAttribute('data-dnd-over', '');
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
  drag.source = null;
  document.body.classList.remove('inv-dragging');
}

function finishDrag(commit: boolean): void {
  const source = drag.source;
  const overId = drag.over;

  if (commit && source && overId) {
    const droppable = droppables.get(overId);
    // Re-check canDrop at release: the pointer has not moved, but state may have
    // changed under it since the last hit test.
    if (droppable && (!droppable.canDrop || droppable.canDrop(source))) droppable.ondrop(source);
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
    }

    movePreview(event.clientX, event.clientY);
    setOver(hitTest(event.clientX, event.clientY));
  }

  function onPointerUp() {
    const wasDragging = !pending;
    teardown();
    if (wasDragging) finishDrag(true);
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
      if (drag.over === id) setOver(null);
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
