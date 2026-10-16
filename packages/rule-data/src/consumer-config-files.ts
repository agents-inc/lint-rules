/**
 * The files a consumer writes for this package. The rules those files break ship with these names,
 * under any directory, among their ignores in data/rules.json. Imports nothing, so lint-rules can
 * take the names without loading the catalog.
 */
export const consumerConfigFiles = {
  lintRules: 'agents-inc.lint.mts',
  oxlintConfig: 'oxlint.config.mts',
  eslintConfig: 'eslint.config.mjs',
} as const
