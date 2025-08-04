import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'keytar', 'better-sqlite3', 'drizzle-orm/better-sqlite3'],
      output: {
        entryFileNames: 'main.js'
      }
    }
  },
  resolve: {
    conditions: ['node'],
    extensions: ['.ts', '.js', '.mjs', '.json']
  }
});