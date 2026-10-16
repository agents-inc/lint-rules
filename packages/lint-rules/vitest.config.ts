import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'mutation-testing/**/*.test.ts'],
    globals: false,
    clearMocks: true,
    // The runner lives in rule-data, which this package depends on, so turbo hashes it for both
    // packages' tests. By its absolute path, so a config that extends this one from another root loads it too.
    runner: fileURLToPath(new URL('../rule-data/src/__tests__/temp-dir-per-test-file.ts', import.meta.url)),
  },
})
