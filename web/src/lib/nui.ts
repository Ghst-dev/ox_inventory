/**
 * NUI bridge.
 *
 * ox_inventory's wire protocol is `{ action, data }` — the same envelope ox_lib uses,
 * and not the flat `{ event, ...siblings }` of ox_target. Every `action` string and
 * callback name here has to match `client.lua` exactly; a typo fails silently, which
 * is the recurring hazard across all three rebuilds.
 *
 * One asymmetry worth knowing: `getItemData` is a real request/response — the UI asks
 * Lua for an item definition and awaits the answer. Everything else is fire and forget
 * apart from `swapItems`, whose reply decides whether an optimistic move is kept.
 */

import { nuiMocks } from './mocks';

// Capture the real fetch before it is taken away below. Bound, because the guard installed
// below hands it back out and a detached `fetch` is not guaranteed to accept a bare call.
const realFetch = window.fetch.bind(window);

/** True when running in a normal browser rather than the game's CEF instance. */
export const isEnvBrowser = (): boolean => !(window as any).invokeNative;

/**
 * Kept from the React implementation: once the page has what it needs, remove its
 * ability to make arbitrary network requests, so a compromised NUI page cannot phone
 * home. Only applied in game — nulling these in a browser breaks Vite's dev client.
 *
 * **Refused by origin, not wholesale.** The React version assigned `() => {}`, which
 * returns `undefined` rather than a promise, so anything reaching for the global instead
 * of `fetchNui` below died on `.then` of undefined. That is not hypothetical:
 * `lib/prefs.svelte.ts` is copied into every ghst UI and uses bare `fetch` deliberately,
 * because it cannot depend on a helper whose name differs in each one. `main.ts` imports
 * this module first, so prefs only ever saw the stub — the preferences handshake has never
 * once completed in either fork, and both pages threw on load.
 *
 * A POST at this page's own resource is the NUI callback channel, not a way out, so the
 * ban is on everything else. Refusals reject with the `TypeError` a blocked request
 * produces, which is what callers already catch; a stub that breaks the promise contract
 * is how this stayed invisible for so long.
 */
if (!isEnvBrowser()) {
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    let origin: string | null = null;

    try {
      origin = new URL(input instanceof Request ? input.url : String(input), location.href).origin;
    } catch {
      /* Unparseable is not same-origin. */
    }

    if (origin !== location.origin) return Promise.reject(new TypeError('Failed to fetch'));

    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;

  // XHR gets no such carve-out — nothing in either fork uses it, so it stays gone. Its own
  // stub rather than an alias of the above, which would now hand back a working fetch under
  // a name that is meant to be dead.
  window.XMLHttpRequest = function () {
    throw new TypeError('XMLHttpRequest is disabled in NUI');
  } as unknown as typeof XMLHttpRequest;
}

/**
 * The host the NUI callback endpoint answers on.
 *
 * **The page's own hostname first**, which is `cfx-nui-ox_inventory` — not the bare resource
 * name `GetParentResourceName` returns. Both are routed to this resource, so the swap changes
 * nothing about where a callback lands; what it changes is that every request the page makes is
 * now *same-origin*, which is what lets `index.html` declare `connect-src 'self'` and have the
 * browser enforce the rule the guard above only asks for politely. `ox_target/web/src/lib/nui.ts`
 * reached the same conclusion first and has been running on it.
 *
 * `GetParentResourceName` is kept behind it for a page the hostname does not name.
 */
const resourceName = (): string =>
  window.location.hostname || (window as any).GetParentResourceName?.() || 'nui-frame-app';

/**
 * POST to a `RegisterNUICallback` endpoint and return its `cb(...)` value.
 *
 * In a plain browser there is no CEF to answer, and the request resolves to a DNS
 * failure that Chromium logs regardless of whether the promise is caught. The dev
 * harness drives the UI with `debugData` rather than round-trips, so short-circuit
 * instead — it keeps the console readable, which matters when the console is how you
 * spot a mistyped action name.
 */
export async function fetchNui<T = any>(eventName: string, data?: unknown): Promise<T> {
  if (isEnvBrowser()) {
    const mock = nuiMocks[eventName];
    const value = typeof mock === 'function' ? mock(data) : mock;

    console.debug(`[nui] fetchNui("${eventName}") skipped — not running in CEF`, data, '->', value);
    return value as T;
  }

  const resp = await realFetch(`https://${resourceName()}/${eventName}`, {
    method: 'post',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data),
  });

  return resp.json();
}

interface NuiMessage<T = unknown> {
  action: string;
  data: T;
}

/**
 * Subscribe to a `SendNUIMessage` action. Returns an unsubscribe function, so it can be
 * returned directly from `$effect` or `onMount`.
 */
export function onNuiEvent<T = any>(action: string, handler: (data: T) => void): () => void {
  const listener = (event: MessageEvent<NuiMessage<T>>) => {
    if (event.data?.action === action) handler(event.data.data);
  };

  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

interface DebugEvent<T = unknown> {
  action: string;
  data: T;
}

/**
 * Fire inbound NUI messages at ourselves, so the UI can be driven in a browser with no
 * game running. No-ops in the game and in production builds.
 */
export function debugData<T>(events: DebugEvent<T>[], timer = 1000): void {
  if (!import.meta.env.DEV || !isEnvBrowser()) return;

  for (const event of events) {
    setTimeout(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { action: event.action, data: event.data },
        }),
      );
    }, timer);
  }
}
