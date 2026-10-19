import { mergeEslintConfig } from '@agents-inc/lint-rules/eslint'
import { eslint } from './agents-inc.lint.mts'

// Merged, our ignores keep only our rules out, so this repo leaves these out itself: code that breaks rules on
// purpose, with configs of its own, and the copies of the source Stryker makes.
const theirExistingConfig = [{ ignores: ['packages/lint-rules/test-fixtures/**', '.stryker-tmp/**'] }]

export default mergeEslintConfig(theirExistingConfig, eslint, { oxlintConfig: 'oxlint.config.mts' })
