/**
 * C3 Desktop Shell — Vite Configuration
 *
 * Build topology:
 *   - renderer: built by Vite (React + HMR in dev, static HTML/JS/CSS in prod)
 *   - main:    bundled by vite-plugin-electron into CJS for Electron main process
 *   - preload: bundled by vite-plugin-electron into CJS for Electron preload
 *
 * Output layout:
 *   dist-electron/
 *     main/index.js      ← Electron main process
 *     preload/index.js   ← Electron preload
 *   dist-renderer/
 *     index.html         ← renderer entry (loaded by BrowserWindow in production)
 *
 * Note: The root monorepo `tsc --build` handles TypeScript type-checking.
 * Vite handles bundling for the Electron runtime only.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  build: {
    outDir: path.join(__dirname, 'dist-renderer'),
    emptyOutDir: true,
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: path.join(__dirname, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: path.join(__dirname, 'dist-electron/main'),
            rollupOptions: {
              external: [
                'electron',
                // Keep @c3/foundation as external — it will be resolvable at runtime
                '@c3/foundation',
                '@c3/contracts',
              ],
            },
          },
          resolve: {
            alias: {
              '@c3/foundation': path.join(__dirname, '../../packages/foundation/src/index.ts'),
              '@c3/contracts': path.join(__dirname, '../../packages/contracts/src/index.ts'),
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'src/preload/index.ts'),
        vite: {
          build: {
            outDir: path.join(__dirname, 'dist-electron/preload'),
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@c3/foundation': path.join(__dirname, '../../packages/foundation/src/index.ts'),
      '@c3/contracts': path.join(__dirname, '../../packages/contracts/src/index.ts'),
    },
  },
});
