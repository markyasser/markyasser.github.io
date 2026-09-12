import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset URLs so the build works from any sub-path — GitHub Pages
  // project sites, a CDN folder, or opened straight off disk.
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 1200,
  },
})
