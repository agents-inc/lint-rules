import { describe, expect, it } from 'vitest'
import { buildOxlintConfigModule, oxlintConfigModuleText, positionInTheMergeCall } from './oxlint-config-module-factories.ts'

const MODULE_HOLDING_A_DECLARATION = buildOxlintConfigModule({
  declarations: ["const ESLINT_CONFIG: string = 'eslint.config.mjs'"],
  mergeArguments: '{}, oxlint, { eslintConfig: ESLINT_CONFIG }',
})

describe('oxlintConfigModuleText', () => {
  it('writes the imports, then each declaration given, then the merge call with the arguments given', () => {
    expect(oxlintConfigModuleText(MODULE_HOLDING_A_DECLARATION).split('\n')).toStrictEqual([
      "import { mergeOxlintConfig } from '@agents-inc/lint-rules/oxlint'",
      "import { eslint, oxlint } from './agents-inc.lint.mts'",
      '',
      "const ESLINT_CONFIG: string = 'eslint.config.mjs'",
      'export default mergeOxlintConfig({}, oxlint, { eslintConfig: ESLINT_CONFIG })',
      '',
    ])
  })

  it('merges the oxlint part into an empty config, naming no ESLint config, where no arguments are given', () => {
    expect(oxlintConfigModuleText(buildOxlintConfigModule()).split('\n')).toStrictEqual([
      "import { mergeOxlintConfig } from '@agents-inc/lint-rules/oxlint'",
      "import { eslint, oxlint } from './agents-inc.lint.mts'",
      '',
      'export default mergeOxlintConfig({}, oxlint, { eslintConfig: null })',
      '',
    ])
  })
})

describe('positionInTheMergeCall', () => {
  it('gives the line and column, counted from 1, where the text first starts in the merge call', () => {
    const { line, column } = positionInTheMergeCall(MODULE_HOLDING_A_DECLARATION, 'eslintConfig')
    const lineText = oxlintConfigModuleText(MODULE_HOLDING_A_DECLARATION).split('\n')[line - 1]

    expect({ line, column, from: lineText === undefined ? undefined : lineText.slice(column - 1) }).toStrictEqual({
      line: 5,
      column: 48,
      from: 'eslintConfig: ESLINT_CONFIG })',
    })
  })

  it('throws where the call does not hold the text, and gives the place in one that does', () => {
    expect(positionInTheMergeCall(buildOxlintConfigModule(), 'mergeOxlintConfig')).toStrictEqual({ line: 4, column: 16 })
    expect(() => positionInTheMergeCall(buildOxlintConfigModule(), 'eslint,')).toThrow(
      new Error('the merge call does not hold eslint,: export default mergeOxlintConfig({}, oxlint, { eslintConfig: null })'),
    )
  })
})
