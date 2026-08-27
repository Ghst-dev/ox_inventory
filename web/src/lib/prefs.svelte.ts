/**
 * The three interface preferences every ghst UI shares, received and applied.
 *
 * **Why this is one file copied into thirteen repositories rather than a package.** Cross-resource
 * sharing was ruled out deliberately and that call still holds -- a package boundary between
 * vendored MIT forks and GPL resources is worse than a copy. This is the same arrangement as
 * `theme/tokens.css`, and it keeps the same discipline: change it in `Tools/ghst_template` and
 * sync outward, never the other way round.
 *
 * **The Lua half is `ghst_prefs`**, which owns the KVP and broadcasts `ghst_prefs:changed`. Each
 * resource's client forwards that to its own page as a `ghst:prefs` NUI message. Nothing here
 * asks for anything: a page cannot know when the transport last changed, so the transport tells
 * it, on its own start and on every write.
 *
 * **It listens on `window` directly rather than through `lib/nui.ts`.** The thirteen UIs do not
 * agree on the name of that helper -- `onNuiMessage` here, `onNuiEvent` in the ox forks -- and a
 * file that is copied everywhere cannot depend on a name that differs everywhere.
 */

/** Exactly the ids in `ghst_prefs/shared/config.lua`. Renaming one is a breaking change. */
export interface Prefs {
  /** Honoured by `:root[data-reduce-motion]` in theme/base.css. */
  reduceMotion: boolean;
  /** Multiplier on `--ui-px`, which the type scale is expressed in. 0.75 to 1.5. */
  uiScale: number;
  /** 0 to 1. Nothing consumes this yet; the two audio modules are the intended first. */
  uiVolume: number;
}

/**
 * Seeded with the same defaults `ghst_prefs/shared/config.lua` declares.
 *
 * Duplicated on purpose, and it is a duplicate that cannot drift silently: a page renders before
 * any message arrives, so *something* has to be true on the first frame. The alternative is a
 * frame of unstyled scale, which is worse than a number that agrees with Lua by inspection.
 */
export const prefs = $state<Prefs>({
  reduceMotion: false,
  uiScale: 1,
  uiVolume: 0.6,
});

/**
 * Apply what the page can apply without asking a component to do anything.
 *
 * Both land on the document element rather than on a root component, because the theme's own
 * contract is written against `:root` -- and because a component that owns them cannot apply
 * them before it mounts.
 */
function apply(): void {
  const root = document.documentElement;

  root.toggleAttribute('data-reduce-motion', prefs.reduceMotion === true);
  root.style.setProperty('--ui-scale', String(prefs.uiScale));
}

/** Ignore anything the wire did not actually carry, and keep the rest. */
function merge(next: Partial<Prefs> | undefined): void {
  if (!next || typeof next !== 'object') return;

  if (typeof next.reduceMotion === 'boolean') prefs.reduceMotion = next.reduceMotion;
  if (typeof next.uiScale === 'number' && next.uiScale > 0) prefs.uiScale = next.uiScale;
  if (typeof next.uiVolume === 'number' && next.uiVolume >= 0) prefs.uiVolume = next.uiVolume;

  apply();
}

/**
 * The resource whose `RegisterNUICallback` answers, as a hostname.
 *
 * **Read off the page's own URL, because a DUI has no `GetParentResourceName`.** That shim is
 * injected into fullscreen NUI pages only, and this file mounts in both kinds of browser -- a
 * settings overlay at `https://<resource>/...` and a world board at `nui://<resource>/...`. The
 * hostname is the one answer correct in both, which is the same conclusion `ox_target/lib/nui.ts`
 * and `ghst_garages/lib/dui.ts` each reached on their own; `GetParentResourceName` is kept behind
 * it only for a page the hostname does not name.
 *
 * **What this replaced was worse than a failed request.** It fell back to `''`, which builds
 * `https:///ghst:prefs:ready` -- a URL the parser rejects outright, so `fetch` threw synchronously
 * and the `.catch` below swallowed it without a line in the console. Every DUI in the tree asked
 * for its preferences at mount and not one of them ever did; the boards that looked right looked
 * right because something else had already told them.
 */
function resourceName(): string {
  return (
    window.location.hostname ||
    (window as { GetParentResourceName?: () => string }).GetParentResourceName?.() ||
    ''
  );
}

/**
 * Ask Lua for the current values, once, at mount.
 *
 * **The page has to ask, because the broadcast can arrive before there is a page to hear it.**
 * `SendNUIMessage` to a browser that has not finished loading is a message nobody receives, and
 * `ghst_prefs` broadcasts on its own start -- which on a cold boot is long before this page
 * exists. The event covers every later change; this covers the first frame.
 *
 * Written against `fetch` directly rather than through `lib/nui.ts` for the same reason the
 * listener is: this file is copied into thirteen repositories that do not agree on the name of
 * that helper. In a plain browser there is no `invokeNative`, so there is nothing to ask and the
 * defaults above stand.
 */
function request(): void {
  const native = (window as { invokeNative?: unknown }).invokeNative;

  if (!native) return;

  fetch(`https://${resourceName()}/ghst:prefs:ready`, {
    method: 'post',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: '{}',
  })
    .then((response) => response.json())
    /* A resource that has not registered the callback answers with something that is not a
       preferences table, and `merge` ignores what it does not recognise. Nothing to guard. */
    .then((data) => merge(data as Partial<Prefs>))
    .catch(() => {});
}

/**
 * Start listening. Call once, from `main.ts`, before mounting.
 *
 * Returns the teardown so a dev harness can unsubscribe; nothing in the game ever does, because
 * the page outlives everything that would.
 */
export function listenForPrefs(): () => void {
  apply();

  const listener = (event: MessageEvent) => {
    if (event.data?.type === 'ghst:prefs') merge(event.data.payload as Partial<Prefs>);
  };

  window.addEventListener('message', listener);
  request();

  return () => window.removeEventListener('message', listener);
}

/**
 * Change one preference for the whole session, from a page that offers a control for it.
 *
 * **Nothing is applied optimistically.** The write goes to Lua, Lua writes the KVP, and Lua
 * broadcasts -- which comes back through the listener above and updates `prefs`. A page that
 * assigned locally as well would be the second writer of a value that already has an owner, and
 * two owners is exactly the state this whole mechanism exists to end: the character screen and
 * the inventory each had their own reduce-motion switch, and neither reached the other.
 *
 * The optimistic version is also not worth its risk here. The round trip is a client-side KVP
 * write with no server in it, so the value comes back within a frame.
 */
export function setPref<K extends keyof Prefs>(id: K, value: Prefs[K]): void {
  const native = (window as { invokeNative?: unknown }).invokeNative;

  if (!native) {
    /* No Lua to own it, so the harness owns it -- otherwise a control in the dev browser does
       nothing at all, which reads as a broken control rather than as an absent transport. */
    merge({ [id]: value } as Partial<Prefs>);
    return;
  }

  fetch(`https://${resourceName()}/ghst:prefs:set`, {
    method: 'post',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ id, value }),
  }).catch(() => {});
}

/**
 * Drive the preferences from a dev harness, where there is no Lua to send them.
 *
 * Writes through the same path a real message takes rather than assigning to `prefs`, so the
 * harness cannot demonstrate a behaviour the game does not have.
 */
export function setPrefsForDev(next: Partial<Prefs>): void {
  if (!import.meta.env.DEV) return;

  window.dispatchEvent(
    new MessageEvent('message', { data: { type: 'ghst:prefs', payload: next } }),
  );
}
