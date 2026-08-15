/**
 * The three lookups that arrive once, in `init`, and never change afterwards.
 *
 * The React build kept these as plain mutable module objects (`store/locale.ts`,
 * `store/items.ts`, `store/imagepath.ts`) that were filled in by key rather than
 * replaced — components read them directly and relied on the `init` message landing
 * before first paint. That works, but nothing re-renders if it does not.
 *
 * These are `$state` instead, so a late `init` still updates whatever is already on
 * screen. The inventory contents themselves are a separate, much larger concern and
 * land in their own store in phase 2.
 */

import type { ItemData } from '../typings';

/** UI strings from `locales/*.json`, keyed by their `ui_` name. */
export const locale = $state<Record<string, string>>({});

/** Every item definition on the server, keyed by item name. */
export const items = $state<Record<string, ItemData>>({});

/**
 * Where item images are served from — `client.imagepath`, normally
 * `nui://ox_inventory/web/images`.
 *
 * Held in a wrapper object because a bare exported `$state` string cannot be reassigned
 * from another module; the binding is read-only across the import.
 *
 * Note for browser development: web/images is excluded from the sync (it holds ~169
 * custom item images that belong to the server, not the fork), so images for those
 * items render broken outside the game. That is expected.
 */
export const imagePath = $state({ value: 'nui://ox_inventory/web/images' });

export interface InitPayload {
  locale: Record<string, string>;
  items: Record<string, ItemData>;
  imagepath: string;
}

/** Fill the lookups from an `init` payload, replacing nothing wholesale. */
export function applyInit(data: InitPayload): void {
  for (const key in data.locale) locale[key] = data.locale[key];
  for (const name in data.items) items[name] = data.items[name];

  if (data.imagepath) imagePath.value = data.imagepath;
}
