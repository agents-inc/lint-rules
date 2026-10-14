// eslint.config.mjs
import { mergeEslintConfig } from '@agents-inc/lint-rules/eslint'
import { eslint } from './agents-inc.lint.mts'

const theirExistingConfig = []

export default mergeEslintConfig(theirExistingConfig, eslint, { oxlintConfig: 'oxlint.config.mts' })
