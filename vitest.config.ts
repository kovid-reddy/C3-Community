import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@c3/contracts': path.resolve(__dirname, 'packages/contracts/src'),
      '@c3/foundation': path.resolve(__dirname, 'packages/foundation/src'),
      'react': path.resolve(__dirname, 'apps/desktop/node_modules/react'),
      'react-dom': path.resolve(__dirname, 'apps/desktop/node_modules/react-dom'),
    },
  },
});
