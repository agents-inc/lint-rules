import { type ESLint, Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import { describedTsExpectError, tsIgnore, tsNocheck } from '../__tests__/cases/suppression-comments.ts'
import { rulesOf } from '../__tests__/eslint-plugin-rules.ts'
import { installedEslintPlugin } from '../__tests__/factories/eslint-merge-factories.ts'
import { withOurTsIgnoreMessage } from './ts-ignore-message.ts'

const TYPESCRIPT_ESLINT = '@typescript-eslint'
const TS_COMMENT_BAN = 'ban-ts-comment'
const TS_COMMENT_BAN_ID = `${TYPESCRIPT_ESLINT}/${TS_COMMENT_BAN}`
const BOTH_BANNED = { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true }
const DESCRIBED_EXPECT_ERROR_ALLOWED = { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true }
const THE_OTHER_COMMENT = '@ts-expect-error'
const FIX_THE_TYPE_ERROR = /\bfix\b.+\btype error\b/iu

type Offered = { readonly line: number; readonly message: string; readonly suggestions: readonly string[] }

describe('withOurTsIgnoreMessage', () => {
  it('leaves the plugins as they are where our blocks run no ban-ts-comment', () => {
    const plugins = new Map([[TYPESCRIPT_ESLINT, installedEslintPlugin(TYPESCRIPT_ESLINT)]])

    expect(withOurTsIgnoreMessage(plugins, ['@typescript-eslint/no-explicit-any'])).toBe(plugins)
  })

  it('refuses plugins holding no @typescript-eslint plugin where our blocks run ban-ts-comment, naming what is missing', () => {
    expect(() => withOurTsIgnoreMessage(new Map(), [TS_COMMENT_BAN_ID])).toThrow(new Error(`no plugin under ${TYPESCRIPT_ESLINT}, which runs ${TS_COMMENT_BAN_ID}`))
  })

  it("gives the @typescript-eslint plugin a ban-ts-comment of its own, keeping the plugin's other rules and every other plugin as they are", () => {
    const typescriptEslint = installedEslintPlugin(TYPESCRIPT_ESLINT)
    const unicorn = installedEslintPlugin('unicorn')
    const wrapped = withOurTsIgnoreMessage(
      new Map([
        [TYPESCRIPT_ESLINT, typescriptEslint],
        ['unicorn', unicorn],
      ]),
      [TS_COMMENT_BAN_ID],
    )
    const ours = rulesOf(typescriptEslint)
    const wrappedRules = rulesOf(pluginUnder(wrapped, TYPESCRIPT_ESLINT))

    expect({ replaced: Object.keys(ours).filter((name) => wrappedRules[name] !== ours[name]), unicornKept: wrapped.get('unicorn') === unicorn }).toStrictEqual({
      replaced: [TS_COMMENT_BAN],
      unicornKept: true,
    })
  })

  describe('on a @ts-ignore, @ts-expect-error banned too', () => {
    it('tells the reader to fix the type error, not to use the @ts-expect-error banned there too, and suggests no rewrite', () => {
      const offered = offeredBy(wrappedPlugin(), tsIgnore, BOTH_BANNED)

      expect(offered.map(({ line, message, suggestions }) => ({ line, ...adviceOf(message), suggestions }))).toStrictEqual([
        { line: 1, saysToFixTheTypeError: true, namesTheOtherComment: false, suggestions: [] },
      ])
    })
  })

  describe('on a @ts-ignore, a described @ts-expect-error allowed', () => {
    it("reports as typescript-eslint's rule alone does: its advice to use @ts-expect-error, and its suggestion to replace the comment with one", () => {
      const asShipped = offeredBy(installedEslintPlugin(TYPESCRIPT_ESLINT), tsIgnore, DESCRIBED_EXPECT_ERROR_ALLOWED)

      expect({
        wrapped: offeredBy(wrappedPlugin(), tsIgnore, DESCRIBED_EXPECT_ERROR_ALLOWED),
        asShipped: asShipped.map(({ line, message, suggestions }) => ({ line, ...adviceOf(message), suggestsARewrite: suggestions.length > 0 })),
      }).toStrictEqual({
        wrapped: asShipped,
        asShipped: [{ line: 1, saysToFixTheTypeError: false, namesTheOtherComment: true, suggestsARewrite: true }],
      })
    })
  })

  describe.each([
    { comment: 'a described @ts-expect-error', source: describedTsExpectError },
    { comment: 'a @ts-nocheck', source: tsNocheck },
  ])('on $comment, @ts-expect-error banned too', ({ source }) => {
    it("reports as typescript-eslint's rule alone does", () => {
      const asShipped = offeredBy(installedEslintPlugin(TYPESCRIPT_ESLINT), source, BOTH_BANNED)

      expect({ wrapped: offeredBy(wrappedPlugin(), source, BOTH_BANNED), reportedAsShipped: asShipped.map(({ line }) => line) }).toStrictEqual({
        wrapped: asShipped,
        reportedAsShipped: [1],
      })
    })
  })
})

function wrappedPlugin(): ESLint.Plugin {
  return pluginUnder(withOurTsIgnoreMessage(new Map([[TYPESCRIPT_ESLINT, installedEslintPlugin(TYPESCRIPT_ESLINT)]]), [TS_COMMENT_BAN_ID]), TYPESCRIPT_ESLINT)
}

function pluginUnder(plugins: ReadonlyMap<string, ESLint.Plugin>, prefix: string): ESLint.Plugin {
  const plugin = plugins.get(prefix)
  if (plugin === undefined) throw new Error(`no plugin under ${prefix}`)
  return plugin
}

function offeredBy(plugin: Readonly<ESLint.Plugin>, source: string, options: Readonly<Record<string, unknown>>): Offered[] {
  return new Linter()
    .verify(source, [{ files: ['**/*.ts'], languageOptions: { parser: tseslint.parser }, plugins: { [TYPESCRIPT_ESLINT]: plugin }, rules: { [TS_COMMENT_BAN_ID]: ['error', options] } }], { filename: 'a.ts' })
    .map(({ line, message, suggestions }) => ({ line, message, suggestions: suggestions === undefined ? [] : suggestions.map(({ desc, fix }) => `${desc}: ${fix.text}`) }))
}

function adviceOf(message: string): { readonly saysToFixTheTypeError: boolean; readonly namesTheOtherComment: boolean } {
  return { saysToFixTheTypeError: FIX_THE_TYPE_ERROR.test(message), namesTheOtherComment: message.includes(THE_OTHER_COMMENT) }
}
