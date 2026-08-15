import { mount } from 'svelte';
import App from './App.svelte';
import { debugData, isEnvBrowser } from './lib/nui';
import { nuiMocks } from './lib/mocks';
import { publishScrollbarWidth } from './lib/scrollbar';
import './app.css';

// Before mount: the pane width and the grid's negative margin both depend on this, and
// measuring it after the first pane renders would show a frame of the wrong layout.
publishScrollbarWidth();

const app = mount(App, { target: document.getElementById('root')! });

/**
 * Browser development setup.
 *
 * `import.meta.env.DEV` rather than `isEnvBrowser()` alone, and the fixtures behind a
 * dynamic import: DEV is replaced with a literal `false` at build time, so this whole
 * branch is dead code in production and rollup drops the fixture module with it.
 * isEnvBrowser is a runtime check, which cannot be statically eliminated — guarding on
 * it alone ships the harness and every fixture payload to the game.
 */
if (import.meta.env.DEV && isEnvBrowser()) {
  // NUI pages are transparent by design, which makes them invisible against a white
  // page during `pnpm dev`.
  document.documentElement.classList.add('nui-browser');

  // The mock table, reachable from the console for anything the drawer does not cover.
  // The drawer owns the two switches that matter (refuse / delay); this is the escape
  // hatch for the rest.
  (window as any).__nuiMocks = nuiMocks;

  /**
   * Stand in for the one message client.lua sends unprompted: `init`, once `uiLoaded`
   * has been answered (client.lua:1336-1350). Everything else comes from the drawer,
   * because everything else in game comes from the player doing something.
   */
  import('./features/dev/fixtures').then(({ locale, items, player }) => {
    debugData([
      { action: 'init', data: { locale, items, imagepath: '/images', leftInventory: player } },
    ]);
  });
}

export default app;
