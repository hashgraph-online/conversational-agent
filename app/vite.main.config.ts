import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  define: {
    '__bundlerPathsOverrides': JSON.stringify({
      'thread-stream-worker': null
    }),
    'globalThis.__bundlerPathsOverrides': JSON.stringify({
      'thread-stream-worker': null
    })
  },
  build: {
    rollupOptions: {
      external: ['electron', 'keytar'],
      output: {
        entryFileNames: 'main.js'
      }
    }
  },
  resolve: {
    conditions: ['node']
  }
});