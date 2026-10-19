import { fileURLToPath } from 'node:url'
import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { AGENT_BUILD, type EngineRun, type ErrorAt, type EslintMessageAt, setUpEngineRun } from './__tests__/engine-run.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildErrorOnItsRoutedEngine } from './__tests__/factories/engine-error-factories.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { oxlintCodeOf } from './__tests__/oxlint-codes.ts'
import { defineLintRules, type LintRules } from './index.ts'

// oxlint's jsx-a11y/lang reports a missing lang as html-has-lang does, so beside oxlint html-has-lang is left
// out. ESLint's lang reports no missing lang, so without oxlint the ESLint part keeps both.

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/html-lang', import.meta.url))
const MISSING_LANG_FILE = 'src/missing-lang.jsx'
const WITH_LANG_FILE = 'src/with-lang.jsx'
const HTML_LINE = 1
const HTML_HAS_LANG = 'jsx-a11y/html-has-lang'
const LANG = 'jsx-a11y/lang'
const ESLINT_ERROR = 2
const THE_PAIR: ReadonlySet<string> = new Set([HTML_HAS_LANG, LANG, oxlintCodeOf(HTML_HAS_LANG, catalog), oxlintCodeOf(LANG, catalog)])
const ACCESSIBILITY_LISTED = { agentRulesets: { quality: ['accessibility'] }, editorRulesets: { quality: ['accessibility'] } } as const
const LISTING_OXLINT = { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }
const LISTING_NO_OXLINT = { 'package.json': packageJsonText(buildPackageJsonListingOthers()) }

function definedWith(fields: Pick<LintRules, 'rules'> = {}): (projectDir: string) => ReturnType<typeof defineLintRules> {
  return (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, ACCESSIBILITY_LISTED, fields))
}

function langReportsIn(run: EngineRun, file: string): ErrorAt[] {
  return run.errorsOn(file).filter(({ rule }) => rule !== null && THE_PAIR.has(rule))
}

/** Where the build has no oxlint part, ESLint's messages alone. */
function langMessagesFromEslintIn(run: EngineRun, file: string): EslintMessageAt[] {
  return run.eslintMessagesOn(file).filter(({ ruleId }) => ruleId !== null && THE_PAIR.has(ruleId))
}

describe('an <html> element missing its lang, beside one giving it, the accessibility ruleset listed, in a project whose package.json lists oxlint', () => {
  const builds = [
    { build: 'the agent build', run: setUpEngineRun(FIXTURES_DIR, definedWith(), LISTING_OXLINT, AGENT_BUILD) },
    { build: 'the editor parts merged into empty team configs', run: setUpEngineRun(FIXTURES_DIR, definedWith(), LISTING_OXLINT, buildEditorBuild()) },
  ]
  const namingHtmlHasLang = setUpEngineRun(FIXTURES_DIR, definedWith({ rules: { [HTML_HAS_LANG]: 'error' } }), LISTING_OXLINT, AGENT_BUILD)

  it.each(builds)('draws jsx-a11y/lang alone, from oxlint, in $build', ({ run }) => {
    expect(langReportsIn(run, MISSING_LANG_FILE)).toStrictEqual([buildErrorOnItsRoutedEngine(LANG, HTML_LINE)])
  })

  it.each(builds)('draws neither where lang is given, in $build', ({ run }) => {
    expect(langReportsIn(run, WITH_LANG_FILE)).toStrictEqual([])
  })

  it('draws html-has-lang beside lang where the rules of agents-inc.lint.mts name it, in the agent build', () => {
    expect(langReportsIn(namingHtmlHasLang, MISSING_LANG_FILE)).toStrictEqual([
      buildErrorOnItsRoutedEngine(HTML_HAS_LANG, HTML_LINE),
      buildErrorOnItsRoutedEngine(LANG, HTML_LINE),
    ])
  })
})

describe('an <html> element missing its lang, beside one giving it, the accessibility ruleset listed, in a project whose package.json lists no oxlint', () => {
  const eslintAlone = setUpEngineRun(FIXTURES_DIR, definedWith(), LISTING_NO_OXLINT, buildEditorBuild())

  it('draws html-has-lang alone, from ESLint, in the ESLint part', () => {
    expect(langMessagesFromEslintIn(eslintAlone, MISSING_LANG_FILE)).toStrictEqual([{ ruleId: HTML_HAS_LANG, severity: ESLINT_ERROR, line: HTML_LINE }])
  })

  it('draws neither where lang is given, in the ESLint part', () => {
    expect(langMessagesFromEslintIn(eslintAlone, WITH_LANG_FILE)).toStrictEqual([])
  })
})
