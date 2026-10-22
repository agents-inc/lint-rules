import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config.ts'

// Gives Stryker's copy a `.git`: oxlint honours .gitignore up to the nearest `.git`, and without one
// reads the repo's, which ignores the copy's folder, so `oxlint --print-config` exits 1 (measured).
mkdirSync(new URL('../../.git', import.meta.url), { recursive: true })

// Stryker runs from the repo root, so the tests' root is set back to this package. The bridge hands the
// active mutant to the Node processes read-installed.integration.test.ts spawns.
export default mergeConfig(
  baseConfig,
  defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    test: { setupFiles: ['../lint-rules/mutation-testing/child-process-bridge.ts'] },
  }),
)
