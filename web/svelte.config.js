import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Configured here rather than inline in vite.config.mjs so svelte-check sees the same
// preprocessing the build uses -- otherwise <script lang="ts"> fails to type-check.
export default {
  preprocess: vitePreprocess(),
};
