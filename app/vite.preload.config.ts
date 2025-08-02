import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/preload/index.ts',
      formats: ['cjs'],
      fileName: () => 'preload.js'
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        inlineDynamicImports: true,
        entryFileNames: 'preload.js'
      }
    },
    minify: false,
    emptyOutDir: false
  }
});