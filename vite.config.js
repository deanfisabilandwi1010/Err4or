import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Four real HTML documents (Barba swaps their <main>, but each must also load on its own).
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 900, // three.js is one ~690 kB chunk, loaded only by the pages that need it
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        work: resolve(__dirname, 'work.html'),
        gallery: resolve(__dirname, 'gallery.html'),
        error: resolve(__dirname, '404.html'),
      },
    },
  },
});
