/** A context-menu entry an item declares for itself in data/items.lua. */
export type ItemButton = {
  label: string;
  /** Buttons sharing a group collapse into one submenu. */
  group?: string;
};

export type ItemData = {
  name: string;
  label: string;
  stack: boolean;
  usable: boolean;
  close: boolean;
  count: number;
  description?: string;
  /**
   * Upstream typed this `string[]`, which does not match what is sent: client.lua:1231
   * builds `{ label = ..., group = ... }` for each button, dropping the `action` field
   * (it stays client-side and is invoked by index through the `useButton` callback).
   */
  buttons?: ItemButton[];
  ammoName?: string;
  image?: string;
  /**
   * Which filter chip this item sits under, resolved in Lua (`client.lua`) rather than
   * derived here — an ordinary item declares it in `data/items.lua`, and anything from
   * `data/weapons.lua` is named by the flags shared.lua sets. Always present in game,
   * optional in the type because a definition fetched by `getItemData` is the raw shared
   * table and does not carry it.
   */
  category?: string;
  /** Everything else this fork adds to an item definition, forwarded whole. */
  ghst?: Record<string, unknown>;
  /**
   * Fields that only reach the UI through the `getItemData` callback, which answers with
   * the whole shared item table rather than the eight-key summary `init` sends.
   *
   * `type` is a weapon component's socket ('muzzle', 'grip', 'scope', ...) and is what
   * lets the attachment panel group by where a part fits. Optional on purpose: an item
   * that arrived in `init` and was never looked up individually will not have it.
   */
  type?: string;
  weight?: number;
};
