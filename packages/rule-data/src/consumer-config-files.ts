/**
 * The files a consumer writes for this package. The rules those files break ship with exactly these
 * names, under any directory, as their ignores in data/rules.json. Imports nothing, so lint-rules can
 * take the names without loading the catalog.
 */
export const consumerConfigFiles = {
  lintRules: 'agents-inc.lint.mts',
  oxlintConfig: 'oxlint.config.mts',
  eslintConfig: 'eslint.config.mjs',
} as const
