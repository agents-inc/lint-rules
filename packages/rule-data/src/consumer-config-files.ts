/**
 * The files a consumer writes for this package, among the ignores of the rules they break. Imports
 * nothing, so lint-rules can take the names without loading the catalog.
 */
export const consumerConfigFiles = {
  lintRules: 'agents-inc.lint.mts',
  oxlintConfig: 'oxlint.config.mts',
  eslintConfig: 'eslint.config.mjs',
} as const
