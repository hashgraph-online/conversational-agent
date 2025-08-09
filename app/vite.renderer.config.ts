import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/renderer': path.resolve(__dirname, './src/renderer'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      '@noble/hashes/keccak': path.resolve(__dirname, './node_modules/@noble/hashes/sha3.js'),
      pino: path.resolve(__dirname, './src/lib/pino-stub.ts'),
      'thread-stream': path.resolve(__dirname, './src/lib/thread-stream-stub.ts')
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json']
  },
  optimizeDeps: {
    exclude: ['electron'],
    include: [
      'buffer',
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'zustand',
      'vite-plugin-node-polyfills/shims/buffer',
      'vite-plugin-node-polyfills/shims/global',
      'vite-plugin-node-polyfills/shims/process',
      '@noble/hashes/sha3',
      '@noble/hashes/sha256'
    ],
    force: true,
    esbuildOptions: {
      target: 'esnext',
      supported: {
        'top-level-await': true
      }
    }
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
});