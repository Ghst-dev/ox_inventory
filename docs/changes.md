# What this fork changes

Forked from [overextended/ox_inventory](https://github.com/overextended/ox_inventory) for the
Ghst-dev server. The inventory *model* is upstream's — slots, weight, metadata, stashes,
shops, crafting, the whole server side — so upstream's documentation at
[overextended.dev/ox_inventory](https://overextended.dev/ox_inventory) still applies.

What differs is the interface, and a handful of seams cut for it.

Fork work lives on the **`ghst_ui`** branch, not `main`. `main` tracks upstream.

## Licence

**GPL-3.0**, as upstream. See [LICENSE](../LICENSE) and [NOTICE.md](../NOTICE.md), both
unmodified — the NOTICE file is Linden, Luke and Dunak's and states the terms this fork is
redistributed under.

Two of those terms matter here and are met by this document: *document any modifications made
to the original work*, and *preserve all copyright, license, and attribution notices*.

## The shape of it

| | |
|---|---|
| **99 files** under `web/src` | The NUI, rebuilt |
| **10 files** outside it | Seams the UI needed, plus the framework-strip patches |

## The UI is Svelte, not React

Upstream's NUI is React with `react-dnd`. This one is **Svelte 5 + Vite + Tailwind 4** on the
shared Ghst tokens, with a **pointer-event drag layer** in place of react-dnd — one dependency
instead of three, and a drag that works the same for mouse and touch.

The grid, the state, the tooltip, the context menu, the controls dialog, the hotbar and the
item notifications were all rebuilt rather than restyled.

## What the interface gained

None of this is upstream behaviour. It is the list worth reading if you are wondering why the
inventory looks unfamiliar.

| | |
|---|---|
| **Search, empty and busy states** | A pane says what it is doing rather than looking broken while it waits |
| **Refusals are spoken** | A drop that will be refused says so before you let go, and leaves a hole where the item was rather than snapping it back |
| **Hot slots without opening** | `1`–`5` use a slot without opening the inventory first |
| **Merged notifications** | Repeated ones collapse and carry colour; being overloaded says so |
| **Player settings** | Accent, slot size, tooltip delay and reduced motion, remembered per client |
| **A hotbar worth looking at** | It can stay up, and shows enough to be used |
| **Split at the drop** | Asked how many at the moment you drop, not through a separate dialog |
| **A weapon panel** | Instead of a submenu, with what is in your hands and how another compares |
| **Categories and filter chips** | Items carry a category; panes get a row of chips |
| **Tidy** | Merge what stacks, then order it — with pinned slots left alone |
| **Give, in place** | Pick who gets the item inside the inventory |
| **A ped preview** | A copy of the player beside the inventory. Off by default |
| **Bags open beside a stash** | Rather than replacing it |
| **A voice** | Sound, without shipping a single audio file — see below |

## Sound without audio files

The inventory has audio and the repository has no `.ogg` in it. Sounds are the game's own
frontend sound sets, triggered from Lua, so nothing is streamed and nothing is added to the
resource's size.

## Icons: Lucide, not FontAwesome

Upstream inlines FontAwesome path data. This uses `web/src/lib/icons.ts`, the same explicit
Lucide allowlist every other UI on this server uses — static imports, unused icons dropped by
the bundler.

The trade is the same one: **a name that is not registered renders nothing**, silently, in a
production build. Check the name is on the list when adding a caller.

## Containers come from `data/`

Upstream hard-codes two demo containers at the bottom of `modules/items/containers.lua` — a
paperbag, and a pizzabox whose item does not exist. That file is fork code, so every server
that ever added a backpack edited it, and an upstream bump reverted the edit.

It loads `data/containers.lua` now, beside the item list whose names it has to match. `.sync`
excludes `data/`, so the deployed list survives a deploy exactly the way `items.lua` does, and
this repository's copy is a placeholder that never ships. A missing file is not an error:
`lib.load` returns nil, nothing is registered, and the container paths never fire.

## Ambient surfaces

The inventory takes NUI focus with the game held still behind it, so it keeps the **focused**
panel material throughout. It is listed here only because the shared ambient tier was added to
its `tokens.css` at the same time as everywhere else — nothing in this resource uses it, and
nothing should.

`web/tools/check-tokens.mjs` runs after every build and fails on a `var(--x)` with no fallback
that nothing declares.

## Framework-strip patches

Two changes carried from the server's framework strip rather than invented here: the
`Item('phone')` handler in `modules/items/client.lua` and the npwd `setPhoneDisabled` block in
`client.lua`, both of which drove a resource that is not installed. `data/items.lua` also has
no `phone`, `radio`, `jammer` or `radiocell` item. **Re-adding npwd means undoing all four**,
and that is recorded in `txData/ghst_sv/README.md` as well as here.

## Building

```bash
pnpm --dir Scripts/ox_inventory/web install
pnpm --dir Scripts/ox_inventory/web run dev
pnpm --dir Scripts/ox_inventory/web run build
```

The dev drawer is reached through a dynamic import behind `import.meta.env.DEV`, so it never
ships.

## Deployment

`.sync` marks this fork deployable into `[ox]`, replacing the upstream release copy that
`ghst_sv` used to track. `ghst_sv` gitignores that path now — the source of truth is this
repository. `data/` is excluded from the sync, because the item list, shops, stashes and the
container list are the *server's* content rather than the fork's.

## Where the backlog lives

Planned UI work, and the facts behind each item, are in
`txData/ghst_sv/docs/inventory.md` rather than here. That document is server-level planning —
it covers what should be built and why — where this one covers what already differs from
upstream.
