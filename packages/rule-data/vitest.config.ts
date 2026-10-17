import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    clearMocks: true,
    // Each test file gets its own temp dir, removed however it ends. By absolute path, so the mutation
    // config, which sets another root, loads it too.
    runner: fileURLToPath(new URL('./src/__tests__/temp-dir-per-test-file.ts', import.meta.url)),
  },
})
