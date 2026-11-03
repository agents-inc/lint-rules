import { type ESLint, Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import { RETURNED_USING_RESOURCES, THROWN_USING_RESOURCES, VALUES_RETURNED_IMMEDIATELY_ONCE_FIXED } from '../__tests__/cases/using-resource-sources.ts'
import { CONST_RETURNED_INSIDE_A_USING_DECLARATION } from '../__tests__/cases/using-resources-reported-as-before.ts'
import { rulesOf } from '../__tests__/eslint-plugin-rules.ts'
import { installedEslintPlugin } from '../__tests__/factories/eslint-merge-factories.ts'
import { withReturnedUsingResourcesLeftAlone } from './returned-using-resources.ts'

const SONARJS = 'sonarjs'
const PREFER_IMMEDIATE_RETURN = 'prefer-immediate-return'
const PREFER_IMMEDIATE_RETURN_ID = `${SONARJS}/${PREFER_IMMEDIATE_RETURN}`

describe('withReturnedUsingResourcesLeftAlone', () => {
  it("gives sonarjs' prefer-immediate-return a module of its own and keeps the rest, beside another plugin, kept as it is", () => {
    const sonarjs = installedEslintPlugin(SONARJS)
    const unicorn = installedEslintPlugin('unicorn')
    const ours = rulesOf(sonarjs)
    const leftAlone = rulesOf(withReturnedUsingResourcesLeftAlone(SONARJS, sonarjs))

    expect({
      replaced: Object.keys(ours).filter((name) => leftAlone[name] !== ours[name]),
      otherPluginKept: withReturnedUsingResourcesLeftAlone('unicorn', unicorn) === unicorn,
    }).toStrictEqual({ replaced: [PREFER_IMMEDIATE_RETURN], otherPluginKept: true })
  })

  it('refuses a sonarjs plugin without rules, naming what is missing', () => {
    expect(() => withReturnedUsingResourcesLeftAlone(SONARJS, {})).toThrow(new Error('the plugin under sonarjs has no rules'))
  })

  it('refuses a sonarjs plugin without prefer-immediate-return, naming what is missing', () => {
    expect(() => withReturnedUsingResourcesLeftAlone(SONARJS, { rules: {} })).toThrow(new Error(`${PREFER_IMMEDIATE_RETURN_ID} is not in its plugin`))
  })

  it('reports no returned `using` or `await using` variable, where sonarjs alone reports each', () => {
    const sonarjs = installedEslintPlugin(SONARJS)
    const sources = RETURNED_USING_RESOURCES.map(({ source }) => source)

    expect({
      leftAlone: sources.map((source) => messagesOf(withReturnedUsingResourcesLeftAlone(SONARJS, sonarjs), source)),
      sonarjsAlone: sources.map((source) => messagesOf(sonarjs, source).map(({ ruleId }) => ruleId)),
    }).toStrictEqual({ leftAlone: sources.map(() => []), sonarjsAlone: sources.map(() => [PREFER_IMMEDIATE_RETURN_ID]) })
  })

  it('reports no thrown `using` or `await using` variable, where sonarjs alone reports each', () => {
    const sonarjs = installedEslintPlugin(SONARJS)
    const sources = THROWN_USING_RESOURCES.map(({ source }) => source)

    expect({
      leftAlone: sources.map((source) => messagesOf(withReturnedUsingResourcesLeftAlone(SONARJS, sonarjs), source)),
      sonarjsAlone: sources.map((source) => messagesOf(sonarjs, source).map(({ ruleId }) => ruleId)),
    }).toStrictEqual({ leftAlone: sources.map(() => []), sonarjsAlone: sources.map(() => [PREFER_IMMEDIATE_RETURN_ID]) })
  })

  it('reports a returned or thrown const, and a const returned by a function a `using` declaration calls, as sonarjs alone does, offering its fix', () => {
    const cases = [...VALUES_RETURNED_IMMEDIATELY_ONCE_FIXED, CONST_RETURNED_INSIDE_A_USING_DECLARATION]
    const sonarjs = installedEslintPlugin(SONARJS)
    const leftAlone = cases.map(({ source }) => messagesOf(withReturnedUsingResourcesLeftAlone(SONARJS, sonarjs), source))

    expect({ leftAlone, reported: leftAlone.map((messages) => messages.map(({ ruleId, line, fix }) => ({ ruleId, line, offersAFix: fix !== undefined }))) }).toStrictEqual({
      leftAlone: cases.map(({ source }) => messagesOf(sonarjs, source)),
      reported: cases.map(({ line }) => [{ ruleId: PREFER_IMMEDIATE_RETURN_ID, line, offersAFix: true }]),
    })
  })
})

function messagesOf(plugin: Readonly<ESLint.Plugin>, source: string): Linter.LintMessage[] {
  return new Linter().verify(source, [{ files: ['**/*.ts'], languageOptions: { parser: tseslint.parser }, plugins: { [SONARJS]: plugin }, rules: { [PREFER_IMMEDIATE_RETURN_ID]: 'error' } }], { filename: 'a.ts' })
}
