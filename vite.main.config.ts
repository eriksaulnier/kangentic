import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': '/src/shared',
    },
  },
  build: {
    rollupOptions: {
      external: ['better-sqlite3', 'node-pty', 'simple-git'],
    },
  },
});
