import { mergeEslintConfig } from '@agents-inc/lint-rules/eslint'
import { repoOwnPlugin } from '@workspace/eslint-plugin-house/repo-own-plugin'
import { eslint } from './agents-inc.lint.mts'

// Merged, our ignores keep only our rules out, so this repo leaves these out itself: code that breaks rules on
// purpose, with configs of its own, the copies of the source Stryker makes, and the folder the agents-inc CLI writes.
const theirExistingConfig = [
  { ignores: ['packages/lint-rules/test-fixtures/**', '.stryker-tmp/**', '.agents-inc/**'] },
  // Rules this repo holds its own code to and does not ship. A typed one reads the types our typed blocks give.
  {
    files: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.tsx'],
    plugins: { 'house-repo': repoOwnPlugin },
    rules: { 'house-repo/no-throwing-default-in-exhaustive-switch': 'error' },
  },
]

export default mergeEslintConfig(theirExistingConfig, eslint, { oxlintConfig: 'oxlint.config.mts' })
