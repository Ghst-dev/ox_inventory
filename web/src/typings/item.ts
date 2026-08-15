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
};
