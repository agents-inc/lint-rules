import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config.ts'

// Gives Stryker's copy of the repo a `.git` folder, as the repo has (lint-rules'
// mutation-testing/child-process-bridge.ts does the same). oxlint honours .gitignore up to the nearest
// folder holding `.git`; without one, it reads the repo's own .gitignore, which ignores the folder the
// copy sits in, and `oxlint --print-config` run from the copy exits 1 (measured).
mkdirSync(new URL('../../.git', import.meta.url), { recursive: true })

// Stryker runs from the repo root (stryker.rule-data.config.mjs), so the tests' root is set back to this package.
export default mergeConfig(baseConfig, defineConfig({ root: fileURLToPath(new URL('.', import.meta.url)) }))
