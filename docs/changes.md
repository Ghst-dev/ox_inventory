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
| **52 files** under `web/src` | The NUI, rebuilt |
| **9 files** outside it | Seams the UI needed, plus the framework-strip patches |

Against `main` that is 126 paths changed, because 55 of them are the React tree being deleted.

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
| **Bags open under your own pane** | On a button in its header, rather than replacing whatever you were looking at — [see below](#a-bag-opens-beside-the-inventory-not-instead-of-it) |
| **A voice** | Sound, without shipping a single audio file — see below |

## Sound without audio files

The inventory has audio and the repository has no `.ogg` in it. The five sounds are built in the
browser out of oscillators and filtered noise -- `web/src/lib/audio.ts`, a few numbers each -- so
nothing is streamed, nothing is decoded, and the only thing added to the bundle is that file.

The reason is `fxmanifest.lua`. Its `files` block globs exactly two things out of the built
bundle, `web/build/assets/*.js` and `*.css`; a loose `.ogg` beside them is not published by the
resource and 404s in game. Shipping a recorded clip would mean base64ing it into the JS chunk --
tens of kilobytes of string constant nobody can adjust without an audio editor. Changing one of
these is editing a frequency.

Volume is the shared `uiVolume` preference, so the inventory is as loud as everything else on the
server. See [ghst_prefs](#shared-preferences) below.

## A bag opens beside the inventory, not instead of it

The largest behaviour change here, and the one with the most rules behind it.

Upstream shows a container the same way it shows a stash: as the right-hand pane, replacing
whatever was there. Walking up to a stash wearing a backpack therefore meant choosing which of
the two you could see. Using a bag with the window already open now adds a **third pane**, under
your own inventory, on your side of the control column.

**How the security survives it.** All of ox_inventory's transfer security rests on
`playerInventory.open` being a single id the *server* chose — `swapItems` resolves the non-player
side from it, which is why a client can never name an inventory. Widening `open` into a set would
hand that decision to the client for every inventory type at once. A container is the one
exception that costs nothing, because it is addressed by a **slot in the player's own inventory**
rather than by an id: the worst a forged `fromType = 'container'` can reach is a bag the player is
already carrying. So `open` is left alone and the bag is recorded in `containerSlot`, which the
server already maintained.

**One bag at a time.** `container` is a *type* on the wire, and the page resolves a type to a
pane — so two panes wearing it are two panes it cannot tell apart. A bag opened with the window
shut is still the right-hand pane, so using a second bag while that one is up replaces it rather
than adding a third (`client.openContainer`). The server is single-minded for its own reason:
`containerSlot` is one field.

**The open bag does not move.** Every `container` move resolves through `containerSlot`, so a
move that empties or overwrites that slot leaves the field naming something else. The drag is
refused in the UI (`onDrop`) and again on the server (`swapItems`), rather than the field being
repointed — repointing means guessing where the bag landed, and closing the bag first is one
click.

**What stays impossible.** A bag cannot trade directly with a stash: the exploit guard at the top
of `swapItems` requires one side of any move to be the player, and that guard is worth more than
the convenience. The UI refuses that drag visibly rather than letting the server reject it. A
container cannot go inside a container either, which would nest weight calculations indefinitely.

## Shared preferences

Reduce motion, interface size and interface volume are not this inventory's settings. They belong
to the player, and `ghst_prefs` owns them for every interface on the server — so the switch here
and the one on the character screen are the same switch.

`modules/prefs/client.lua` is six lines carrying that transport the last step into the page, and
`web/src/lib/prefs.svelte.ts` is the copy of the shared client file every ghst UI has. A **soft
dependency**, deliberately: `ghst_prefs` is not in `fxmanifest`'s `dependencies{}`, because a
missing preferences resource should cost a player their preferences and not their inventory.

Nothing is applied optimistically. A control writes to Lua, Lua writes the KVP and broadcasts,
and the value arrives back through the listener — which is what stops two interfaces disagreeing
about the answer.

What stayed local is in `web/src/lib/settings.svelte.ts` and lives in `localStorage`: accent, slot
size, tooltip delay, hotbar mode and the pinned slots. Those describe this inventory and nothing
else.

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

## A locked car has a locked boot

One condition in `Inventory.CanAccessTrunk` (`modules/inventory/client.lua`), and the only
behaviour change outside the interface.

Upstream checks the vehicle class, the storage data, that a boot door exists and that you are
within a metre and a half of it — and never asks whether the vehicle is **locked**, so the boot
prompt appeared on every car within reach.

**This is the prompt, not the gate.** `openInventory`'s trunk branch on the server has always
tested `GetVehicleDoorLockStatus` and answered `vehicle_locked`, so a locked boot was never
actually lootable. What this line decides is whether the player is offered something that will
work — which is why it has to reach the *same* answer the server will.

It reads `Entity(entity).state.doorslockstate` and falls back to the native, rather than calling
`exports.ghst_vehiclekeys:IsAccessible`. The lock state is already replicated to every client, so
there is no round trip, no export call per frame, and no dependency on that resource being
started. The fallback is the part that matters: a world vehicle has no lock state until somebody
tries a door, and testing the statebag alone read every untouched car as unlocked — a prompt that
lies. `ghst_vehiclekeys` documents the same trap in `GhstKeys.lockState`, where reading "not 2"
as unlocked made a lockpick report a car it had never rolled for.

The values are the server's, verbatim: 0 no lock, 1 unlocked, 8 boot unlocked, everything else
locked. Testing `== 2` alone was safe only because `ghst_vehiclekeys` writes nothing but 1 and 2,
which stops being true the moment the native answers instead.

Keys are deliberately *not* consulted. Locked means locked, including for the owner, who
unlocks the car and then opens the boot. That is one extra press, and it is the same press a
thief has to earn.

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
