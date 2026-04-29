import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Prevent Vite from walking up and auto-loading a PostCSS config from a
  // parent directory (e.g. F:\Web App\postcss.config.js) that references
  // plugins we don't have installed. We don't test CSS anyway.
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.{js,ts,mjs}', 'lib/**/*.test.{js,ts,mjs}'],
    exclude: ['node_modules', '.next', 'Backup', 'Last Version', 'anti_version', 'scratch'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['lib/**/*.{js,ts}'],
      exclude: ['lib/**/*.test.*', 'lib/controllers/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd()),
    },
  },
});
