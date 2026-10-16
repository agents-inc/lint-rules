// Mutates packages/rule-data/src with that package's own tests (docs/work/mutation-testing.md):
// stryker.config.json pointed at rule-data. Its tests run in-process and take seconds, so the mutants
// that run while modules load are tested here too (`ignoreStatic` off) and need no second pass. No
// build runs, and nothing gets `// @ts-nocheck`: the test of the generated files compares them on
// disk, which is also why they are not mutated.
import { readFileSync } from 'node:fs'

const lintRulesConfig = JSON.parse(readFileSync(new URL('./stryker.config.json', import.meta.url), 'utf8'))

export default {
  ...lintRulesConfig,
  vitest: { ...lintRulesConfig.vitest, configFile: 'packages/rule-data/vitest.mutation.config.ts' },
  tsconfigFile: 'packages/rule-data/tsconfig.json',
  buildCommand: undefined,
  mutate: [
    'packages/rule-data/src/**/*.ts',
    '!packages/rule-data/src/**/*.test.ts',
    '!packages/rule-data/src/**/*.d.ts',
    '!packages/rule-data/src/__tests__/**',
    '!packages/rule-data/src/generated/**',
  ],
  disableTypeChecks: false,
  ignoreStatic: false,
  incrementalFile: 'reports/stryker-incremental.rule-data.json',
}
