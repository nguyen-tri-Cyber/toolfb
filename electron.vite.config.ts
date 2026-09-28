import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve('dist/main'),
      emptyOutDir: false
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve('dist/preload'),
      emptyOutDir: false,
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      outDir: resolve('dist/renderer'),
      emptyOutDir: false
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    }
  }
});
