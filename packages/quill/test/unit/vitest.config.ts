import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js'],
  },
  test: {
    include: [resolve(__dirname, '**/*.spec.ts')],
    typecheck: {
      enabled: true,
      include: [resolve(__dirname, '**/*.test-d.ts')],
    },
    setupFiles: [
      resolve(__dirname, '__helpers__/expect.ts'),
      resolve(__dirname, '__helpers__/cleanup.ts'),
    ],
    browser: {
      enabled: true,
      provider: 'playwright',
      name: process.env.BROWSER || 'chromium',
      // Headless by default so a test run never steals focus. Set HEADED=true to watch it.
      headless: process.env.HEADED !== 'true',
    },
  },
});
