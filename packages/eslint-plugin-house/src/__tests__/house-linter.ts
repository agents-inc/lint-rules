import { TSESLint } from '@typescript-eslint/utils'

import { housePlugin } from '../index.ts'

type HouseRuleName = keyof typeof housePlugin.rules

const HOUSE_PREFIX = 'house'

// JSX parses as in the rule tester, TypeScript does not. ESLint's flat config lints only `.js`, `.mjs`
// and `.cjs` by default, so a `filename` takes one of those.
function houseRuleConfig(ruleName: HouseRuleName, options: readonly unknown[]): TSESLint.FlatConfig.Config {
  return {
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { [HOUSE_PREFIX]: housePlugin },
    rules: { [`${HOUSE_PREFIX}/${ruleName}`]: ['error', ...options] },
  }
}

/** Lints through ESLint itself, which checks the options against the rule's schema as a consumer's config is. */
export function lintWithHouseRule(
  ruleName: HouseRuleName,
  options: readonly unknown[],
  code: string,
  filename: string,
): TSESLint.Linter.LintMessage[] {
  const linter = new TSESLint.Linter({ configType: 'flat' })
  return linter.verify(code, [houseRuleConfig(ruleName, options)], filename)
}

/** Lints with inline config ignored, so a directive in the code cannot silence the rule under test. */
export function lintWithInlineConfigIgnored(
  ruleName: HouseRuleName,
  code: string,
  filename: string,
): TSESLint.Linter.LintMessage[] {
  const linter = new TSESLint.Linter({ configType: 'flat' })
  return linter.verify(code, [houseRuleConfig(ruleName, [])], { filename, allowInlineConfig: false })
}
