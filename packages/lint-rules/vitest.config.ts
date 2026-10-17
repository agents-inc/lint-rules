import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'mutation-testing/**/*.test.ts'],
    globals: false,
    clearMocks: true,
    // Absolute, so a config extending this one from another root still finds it.
    runner: fileURLToPath(new URL('../rule-data/src/__tests__/temp-dir-per-test-file.ts', import.meta.url)),
  },
})
