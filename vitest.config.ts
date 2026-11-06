import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], hookTimeout: 15000, testTimeout: 15000 },
});
