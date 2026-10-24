import { mergeOxlintConfig } from '@agents-inc/lint-rules/oxlint'
import { defineConfig } from 'oxlint'
import { oxlint } from './agents-inc.lint.mts'

// As in eslint.config.mjs. oxlint still lints a folder below with an oxlint config of its own, by that config.
const theirExistingConfig = { ignorePatterns: ['packages/lint-rules/test-fixtures/**', '.stryker-tmp/**', '.agents-inc/**'] }

export default defineConfig(mergeOxlintConfig(theirExistingConfig, oxlint, { eslintConfig: 'eslint.config.mjs' }))
