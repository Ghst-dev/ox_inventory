/**
 * Canned `fetchNui` responses for browser development.
 *
 * Most of ox_inventory's callbacks are fire-and-forget and answer with a bare `1`, but
 * three are awaited and their reply changes what the UI does next. Without these the
 * browser harness cannot exercise those paths at all.
 *
 * Only consulted when running outside CEF; in game the real callback always answers.
 */
export const nuiMocks: Record<string, unknown | ((data?: unknown) => unknown)> = {
  /**
   * The one that matters. `false` rejects the move and rolls the optimistic mutation
   * back; a number is the new container weight; anything else accepts.
   *
   * Set this to `false` (or make it a function returning false for particular slots) to
   * exercise the rollback path in the browser — it is otherwise only reachable in game
   * by hitting a real weight limit or a full inventory.
   */
  swapItems: true,

  /** ox_inventory:buyItem's `response` — false when the player cannot afford it. */
  buyItem: true,

  /** craftItem answers immediately and loops server-side. */
  craftItem: true,

  /**
   * The nearby-player list for the give picker. `false` is the honest default here: it is
   * what client.lua answers when `inventory:giveplayerlist` is off, and it is the path
   * that falls back to the old aim-and-give call. DevPanel replaces it with a real list.
   */
  getGiveTargets: false,

  /** Everything else: the `cb(1)` acknowledgement. */
  useItem: 1,
  giveItemTo: 1,
  giveItem: 1,
  useButton: 1,
  removeComponent: 1,
  removeAmmo: 1,
  exit: 1,
  uiLoaded: 1,

  /** Item definitions are looked up on demand; the harness has none to give. */
  getItemData: undefined,
};
