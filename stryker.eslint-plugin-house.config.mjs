// Mutates packages/eslint-plugin-house/src with that package's own tests
// (docs/work/mutation-testing.md): stryker.config.json pointed at the house plugin. Its rule tests run
// in-process and take seconds, so the mutants that run while modules load are tested here too
// (`ignoreStatic` off) and need no second pass. No build runs, and nothing gets `// @ts-nocheck`.
import { readFileSync } from 'node:fs'

const lintRulesConfig = JSON.parse(readFileSync(new URL('./stryker.config.json', import.meta.url), 'utf8'))

export default {
  ...lintRulesConfig,
  vitest: { ...lintRulesConfig.vitest, configFile: 'packages/eslint-plugin-house/vitest.mutation.config.ts' },
  tsconfigFile: 'packages/eslint-plugin-house/tsconfig.json',
  buildCommand: undefined,
  mutate: [
    'packages/eslint-plugin-house/src/**/*.ts',
    '!packages/eslint-plugin-house/src/**/*.test.ts',
    '!packages/eslint-plugin-house/src/__tests__/**',
  ],
  disableTypeChecks: false,
  ignoreStatic: false,
  incrementalFile: 'reports/stryker-incremental.eslint-plugin-house.json',
}
