// rule-data's tests are fast, so static mutants are tested here too (`ignoreStatic` off) and need no
// second pass. The bridge its vitest config loads hands the mutant to the Node process
// read-installed.integration.test.ts spawns. Generated files are compared on disk by a test, so not mutated.
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
    '!packages/rule-data/src/**/*.test-d.ts',
    '!packages/rule-data/src/**/*.d.ts',
    '!packages/rule-data/src/__tests__/**',
    '!packages/rule-data/src/generated/**',
  ],
  disableTypeChecks: false,
  ignoreStatic: false,
  incrementalFile: 'reports/stryker-incremental.rule-data.json',
}
