import { TSESLint } from '@typescript-eslint/utils'

import { housePlugin } from '../index.ts'

type HouseRuleName = keyof typeof housePlugin.rules

const HOUSE_PREFIX = 'house'

function houseRuleConfig(ruleName: HouseRuleName, entry: TSESLint.Linter.RuleEntry): TSESLint.FlatConfig.Config {
  return { plugins: { [HOUSE_PREFIX]: housePlugin }, rules: { [`${HOUSE_PREFIX}/${ruleName}`]: entry } }
}

/** Lints through ESLint itself, which checks the options against the rule's schema as a consumer's config is. */
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
 * Lints with inline config ignored, so a directive in the code cannot silence the rule under test.
 * ESLint's flat config lints only `.js`, `.mjs` and `.cjs` by default, so `filename` takes one of those.
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
