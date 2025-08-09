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
  ,
  resolve: {
    alias: {
      pino: '/Users/michaelkantor/CascadeProjects/hashgraph-online/conversational-agent/app/src/lib/pino-stub.ts',
      'thread-stream': '/Users/michaelkantor/CascadeProjects/hashgraph-online/conversational-agent/app/src/lib/thread-stream-stub.ts'
    }
  }
});