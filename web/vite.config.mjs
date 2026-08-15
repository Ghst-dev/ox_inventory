import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Tailwind v4 needs no config file -- the theme is declared in src/theme/tokens.css.
  plugins: [tailwindcss(), svelte()],
  // Relative asset paths -- NUI's Chromium loads the page from nui://, not a web root.
  base: './',
  // Item images live in web/images and are addressed through client.imagepath at
  // runtime, not bundled. Nothing here should be copied into the build.
  publicDir: false,
  server: {
    // ox_lib is on 3000 and ox_target on 3001; all three can run at once.
    port: 3002,
  },
  build: {
    // Must stay 'build': fxmanifest.lua:33 declares `ui_page 'web/build/index.html'`.
    outDir: 'build',
    target: 'esnext',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Fixed names rather than hashed ones, carried over from the React config.
        // fxmanifest.lua:40-41 globs `web/build/assets/*.js` and `*.css`, which hashed
        // names would still match -- but a stable filename means the manifest can be
        // read and understood without running a build first. Safe only because there is
        // a single entry and no code splitting; two chunks sharing a name would collide.
        assetFileNames: 'assets/[name][extname]',
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
      },
    },
  },
});
