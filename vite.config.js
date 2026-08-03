import { defineConfig } from 'vite';

// base './' makes every asset URL relative, so the build works when GitHub
// Pages serves the site from /<repo-name>/ instead of the domain root.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
});
