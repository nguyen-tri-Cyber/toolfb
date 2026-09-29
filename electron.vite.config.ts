import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: {
        __META_OAUTH_BROKER_URL__: JSON.stringify(process.env.META_OAUTH_BROKER_URL ?? ''),
        __IS_DEV__: JSON.stringify(isDev)
      },
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
      define: {
        __IS_DEV__: JSON.stringify(isDev)
      },
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
  };
});

