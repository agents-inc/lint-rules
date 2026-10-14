import { RuleTester } from '@typescript-eslint/rule-tester'
import { afterAll, describe, it } from 'vitest'

// The tester registers its suites through these hooks; vitest runs with `globals: false`, so it
// cannot find them on its own.
RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

// As in the shipped ESLint config, an unused disable directive is not reported: a case quoting a
// directive would otherwise fail on a warning no house rule produced.
export const houseRuleTester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  linterOptions: { reportUnusedDisableDirectives: 'off' },
})
