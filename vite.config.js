import { defineConfig } from 'vite';

// base './' makes every asset URL relative, so the build works when GitHub
// Pages serves the site from /<repo-name>/ instead of the domain root.
// The build lands in docs/ because GitHub Pages serves main:/docs directly.
export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
});
