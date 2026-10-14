// oxlint.config.mts
import { mergeOxlintConfig } from '@agents-inc/lint-rules/oxlint'
import { defineConfig } from 'oxlint'
import { oxlint } from './agents-inc.lint.mts'

const theirExistingConfig = {}

export default defineConfig(mergeOxlintConfig(theirExistingConfig, oxlint, { eslintConfig: 'eslint.config.mjs' }))
