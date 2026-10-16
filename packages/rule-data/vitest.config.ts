import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    clearMocks: true,
    // Each test file gets a temp dir of its own, removed however the file ends, so a suite that fails
    // to load or is skipped leaves no folder behind. By its absolute path, so the mutation config,
    // which sets another root, loads it too.
    runner: fileURLToPath(new URL('./src/__tests__/temp-dir-per-test-file.ts', import.meta.url)),
  },
})
