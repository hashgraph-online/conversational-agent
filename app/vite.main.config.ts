import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main/index.ts'),
      output: {
        entryFileNames: 'main.js',
      },
      external: [
        'electron',
        'better-sqlite3',
        '@hashgraphonline/conversational-agent',
        '@hashgraphonline/standards-agent-kit',
        '@hashgraphonline/standards-sdk'
      ],
    },
    outDir: '.vite/build',
    target: 'node18',
  },
  resolve: {
    conditions: ['node'],
    extensions: ['.ts', '.js', '.mjs', '.json'],
    alias: {
      pino: path.resolve(__dirname, './src/lib/pino-stub.ts'),
      'thread-stream': path.resolve(
        __dirname,
        './src/lib/thread-stream-stub.ts'
      ),
    },
  },
});
