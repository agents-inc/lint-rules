import { describe, expect, it } from 'vitest'

import { fileTypesOxlintRunsTheRuleIn } from './oxlint-file-types.ts'

// Rules read from data/oxlint-file-types.json: one no guard names, and one of each kind of guard.
const UNGUARDED_RULE = 'no-debugger'
const RULE_GUARDED_TO_TYPESCRIPT = 'typescript/no-explicit-any'
const RULE_GUARDED_FROM_DECLARATION_FILES_ALONE = 'typescript/no-useless-empty-export'

describe('fileTypesOxlintRunsTheRuleIn', () => {
  it('runs a rule no guard names in every extension oxlint lints, declaration files included', () => {
    expect(fileTypesOxlintRunsTheRuleIn(UNGUARDED_RULE)).toStrictEqual({
      extensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'vue', 'svelte', 'astro'],
      skipsDeclarationFiles: false,
    })
  })

  it('runs a guarded rule in the extensions its guard does not skip, declaration files included where the guard keeps them', () => {
    expect(fileTypesOxlintRunsTheRuleIn(RULE_GUARDED_TO_TYPESCRIPT)).toStrictEqual({
      extensions: ['ts', 'mts', 'cts', 'tsx', 'vue', 'svelte', 'astro'],
      skipsDeclarationFiles: false,
    })
  })

  it('skips declaration files for a rule whose guard skips them, in every extension it skips no other way', () => {
    expect(fileTypesOxlintRunsTheRuleIn(RULE_GUARDED_FROM_DECLARATION_FILES_ALONE)).toStrictEqual({
      extensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'vue', 'svelte', 'astro'],
      skipsDeclarationFiles: true,
    })
  })
})
