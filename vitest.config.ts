import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    deps: {
      inline: ['@dipchats/shared', '@dipchats/database']
    }
  },
  resolve: {
    alias: {
      '@dipchats/shared': '/packages/shared/src/index.ts',
      '@dipchats/database': '/packages/database/src/index.ts'
    }
  }
});
