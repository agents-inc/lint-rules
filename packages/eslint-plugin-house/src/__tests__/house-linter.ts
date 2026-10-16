import { TSESLint } from '@typescript-eslint/utils'

import { housePlugin } from '../index.ts'

type HouseRuleName = keyof typeof housePlugin.rules

const HOUSE_PREFIX = 'house'

function houseRuleConfig(ruleName: HouseRuleName, entry: TSESLint.Linter.RuleEntry): TSESLint.FlatConfig.Config {
  return { plugins: { [HOUSE_PREFIX]: housePlugin }, rules: { [`${HOUSE_PREFIX}/${ruleName}`]: entry } }
}

/**
 * Lints `code` as `filename` through ESLint itself with one house rule on. Unlike the rule tester,
 * ESLint checks the options against the rule's schema the way a consumer's config is checked, and
 * throws on a mismatch.
 */
export function lintWithHouseRule(
  ruleName: HouseRuleName,
  options: readonly unknown[],
  code: string,
  filename: string,
): TSESLint.Linter.LintMessage[] {
  const linter = new TSESLint.Linter({ configType: 'flat' })
  return linter.verify(code, [houseRuleConfig(ruleName, ['error', ...options])], filename)
}

/**
 * Lints `code` with one house rule on and ESLint's inline config ignored, so a directive in the
 * code is a plain comment: `/* eslint-disable *\/` cannot silence the rule under test, as it would
 * under the rule tester, and naming a rule ESLint lacks draws no "Definition for rule … not found".
 * ESLint's flat config lints only `.js`, `.mjs` and `.cjs` by default, so `filename` takes one of
 * those; JSX parses in them.
 */
export function lintWithInlineConfigIgnored(
  ruleName: HouseRuleName,
  code: string,
  filename: string,
): TSESLint.Linter.LintMessage[] {
  const linter = new TSESLint.Linter({ configType: 'flat' })
  return linter.verify(
    code,
    [{ languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } }, ...houseRuleConfig(ruleName, 'error') }],
    { filename, allowInlineConfig: false },
  )
}
