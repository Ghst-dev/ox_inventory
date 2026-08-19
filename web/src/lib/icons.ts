/**
 * The icons this UI uses, and only those.
 *
 * ox_lib and ox_target carry a ~100 entry map because icon names reach them from Lua at
 * runtime and have to be resolved by name. Nothing reaches ox_inventory's NUI that way, so
 * there is no map here — just the handful of glyphs the components reference directly.
 *
 * Add an import when a component needs a new one. See lib/Icon.svelte for the renderer.
 */

import ArrowDownAZ from 'lucide/dist/esm/icons/arrow-down-a-z.mjs';
import Info from 'lucide/dist/esm/icons/info.mjs';
import Search from 'lucide/dist/esm/icons/search.mjs';
import Settings from 'lucide/dist/esm/icons/settings.mjs';
import X from 'lucide/dist/esm/icons/x.mjs';

/**
 * A Lucide icon is a list of SVG elements over a 24 unit box, stroked rather than filled —
 * `[tag, attrs][]`. Declared here rather than imported so nothing depends on lucide's
 * internal type paths.
 */
export type IconNode = [tag: string, attrs: Record<string, string | number>][];

export { ArrowDownAZ, Info, Search, Settings, X };
