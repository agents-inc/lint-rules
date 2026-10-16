import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config.ts'

// Stryker runs from the repo root (stryker.config.json), so the tests' root is set back to this package.
export default mergeConfig(
  baseConfig,
  defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    test: { setupFiles: ['./mutation-testing/child-process-bridge.ts'] },
  }),
)
