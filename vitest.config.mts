import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Tests share one database, so run files one after another
    fileParallelism: false,
    testTimeout: 15000,
  },
});
