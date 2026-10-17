// The house plugin's tests run in-process and fast, so static mutants are tested here too
// (`ignoreStatic` off) and need no second pass.
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
