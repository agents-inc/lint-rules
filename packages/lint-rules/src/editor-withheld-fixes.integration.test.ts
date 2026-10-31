import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalog, pluginPrefixOf } from '@workspace/rule-data'
import { foundOr } from '@workspace/rule-data/collections'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import { oxlintCliOutputIn } from '@workspace/rule-data/test-support/oxlint-cli'
import { ESLint, Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import {
  A_REWRITE_SUGGESTED_BESIDE,
  FILES_A_WITHHELD_FIX_WOULD_CHANGE,
  FILES_A_WITHHELD_RULE_SUGGESTS_A_REWRITE_IN,
  FILES_A_WITHHELD_SORTING_OR_REACT_FIX_WOULD_CHANGE,
  FILES_FIXED_BESIDE,
  FILES_FIXED_BESIDE_BROWSER,
  FILES_FIXED_BESIDE_SORTING,
  PLAYWRIGHT_TESTS_A_WITHHELD_FIX_WOULD_CHANGE,
} from './__tests__/cases/editor-withheld-fix-sources.ts'
import { CODE_A_WITHHELD_JSDOM_FIX_WOULD_BREAK } from './__tests__/cases/jsdom-fix-check-sources.ts'
import {
  PLAYWRIGHT_TESTS,
  RULES_SHIPPED_OFF_WITH_THEIR_FIX_WITHHELD,
  SOURCE_A_WITHHELD_SUGGESTION_WOULD_CHANGE,
  SOURCES_A_WITHHELD_FIX_WOULD_CHANGE,
} from './__tests__/cases/rules-shipped-off.ts'
import { writeOxlintConfigFile } from './__tests__/engine-clis.ts'
import { type EngineRun, setUpEngineRun } from './__tests__/engine-run.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildConsumerLintRules, type LintRulesPiece } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { oxlintCodeOfRule } from './__tests__/oxlint-codes.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { projectPathOf } from './__tests__/project-paths.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { type ProjectFiles, textsOf } from './__tests__/temp-projects.ts'
import { WITHHELD_FIXES } from './cli/check/withheld-fixes.ts'
import { defineLintRules } from './index.ts'

allowEveryTestForParallelLoad()

type ReportedFile = (typeof FILES_A_WITHHELD_FIX_WOULD_CHANGE)[number]
type FixedFile = (typeof FILES_FIXED_BESIDE)[number]

/** The rulesets an editor set lists, the rules the team names, the rules among them whose fix check withholds, a file each reports, and files fixed beside them. */
type EditorProject = {
  readonly rulesets: string
  readonly rulesetSets: Parameters<typeof buildConsumerLintRules>[1]
  readonly named?: LintRulesPiece
  readonly rules: readonly string[]
  readonly reported: readonly ReportedFile[]
  readonly fixedBeside: readonly FixedFile[]
}

type ReportOnALine = { readonly file: string; readonly line: number | null }

/** A fix applies on save; a suggestion is listed in the editor's quick-fix menu and applies only when picked. */
type Offered = { readonly offersAFix: boolean; readonly suggestsARewrite: boolean }

/** The files each rule reports and the files fixed beside them, by path. */
type ProjectTexts = { readonly withheld: Readonly<Record<string, string | undefined>>; readonly beside: Readonly<Record<string, string | undefined>> }

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/editor-withheld-fixes', import.meta.url))
const QUALITY_RULESETS_BESIDE_JEST_DOM_TANSTACK_QUERY_AND_ZOD: EditorProject['rulesetSets'] = {
  editorRulesets: { quality: ['correctness', 'tests', 'modern-js', 'redundancy'], libs: { testing: ['jest-dom'], data: ['tanstack-query'], validation: ['zod'] } },
}
const NAMING_EACH_RULE_SHIPPED_OFF_WITH_ITS_FIX_WITHHELD: EditorProject = {
  rulesets: 'the modern-js and redundancy rulesets, the team naming each rule we ship off whose fix check withholds',
  rulesetSets: { editorRulesets: { quality: ['modern-js', 'redundancy'] } },
  named: { rules: Object.fromEntries(RULES_SHIPPED_OFF_WITH_THEIR_FIX_WITHHELD.map((id) => [id, 'error'] as const)) },
  rules: RULES_SHIPPED_OFF_WITH_THEIR_FIX_WITHHELD,
  reported: [...SOURCES_A_WITHHELD_FIX_WOULD_CHANGE, SOURCE_A_WITHHELD_SUGGESTION_WOULD_CHANGE],
  fixedBeside: FILES_FIXED_BESIDE,
}
const EDITOR_PROJECTS: readonly EditorProject[] = [
  {
    rulesets: 'the correctness, tests, modern-js and redundancy rulesets beside jest-dom, tanstack-query and zod',
    rulesetSets: QUALITY_RULESETS_BESIDE_JEST_DOM_TANSTACK_QUERY_AND_ZOD,
    rules: [
      '@tanstack/query/stable-query-client',
      'jest-dom/prefer-checked',
      'jest-dom/prefer-empty',
      'jest-dom/prefer-in-document',
      'jest-dom/prefer-pressed',
      'jest-dom/prefer-required',
      'jest-dom/prefer-to-have-attribute',
      'jest-dom/prefer-to-have-class',
      'no-new-wrappers',
      'sonarjs/no-duplicate-parameterized-test-case',
      'unicorn/prefer-optional-catch-binding',
      'unicorn/prefer-single-call',
      'zod/prefer-trim-before-string-length-checks',
    ],
    reported: FILES_A_WITHHELD_FIX_WOULD_CHANGE,
    fixedBeside: FILES_FIXED_BESIDE,
  },
  {
    rulesets: 'the ordering and import-order rulesets beside react',
    rulesetSets: { editorRulesets: { quality: ['ordering', 'import-order'], libs: { ui: ['react'] } } },
    rules: ['@eslint-react/x-no-missing-context-display-name', 'perfectionist/sort-arrays', 'perfectionist/sort-maps', 'perfectionist/sort-objects', 'perfectionist/sort-sets'],
    reported: FILES_A_WITHHELD_SORTING_OR_REACT_FIX_WOULD_CHANGE,
    fixedBeside: FILES_FIXED_BESIDE_SORTING,
  },
  {
    rulesets: 'the browser, security, modern-js, redundancy and conventions rulesets beside testing-library',
    rulesetSets: { editorRulesets: { quality: ['security', 'modern-js', 'redundancy', 'conventions'], runtimes: ['browser'], libs: { testing: ['testing-library'] } } },
    rules: [
      'testing-library/prefer-presence-queries',
      'unicorn/dom-node-dataset',
      'unicorn/prefer-add-event-listener',
      'unicorn/prefer-https',
      'unicorn/prefer-keyboard-event-key',
      'unicorn/prefer-modern-dom-apis',
      'unicorn/prefer-query-selector',
      'unicorn/require-css-escape',
    ],
    reported: CODE_A_WITHHELD_JSDOM_FIX_WOULD_BREAK,
    fixedBeside: FILES_FIXED_BESIDE_BROWSER,
  },
  {
    rulesets: 'the modern-js and redundancy rulesets beside playwright, the team naming web-first in its Playwright tests',
    rulesetSets: { editorRulesets: { quality: ['modern-js', 'redundancy'], libs: { testing: ['playwright'] } } },
    named: { fileOverrides: [{ files: PLAYWRIGHT_TESTS, rules: { 'playwright/prefer-web-first-assertions': 'error' } }] },
    rules: ['playwright/prefer-web-first-assertions'],
    reported: PLAYWRIGHT_TESTS_A_WITHHELD_FIX_WOULD_CHANGE,
    fixedBeside: FILES_FIXED_BESIDE,
  },
  NAMING_EACH_RULE_SHIPPED_OFF_WITH_ITS_FIX_WITHHELD,
]
const LISTING_OXLINT: ProjectFiles = { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }
const LISTING_NO_OXLINT: ProjectFiles = { 'package.json': packageJsonText(buildPackageJsonListingOthers()) }
// A name no engine finds by itself, so only the fix run reads it.
const FIX_RUN_OXLINT_CONFIG = 'fix-on-save.oxlintrc.json'
const FILES_REWRITES_ARE_SUGGESTED_IN: ProjectFiles = Object.fromEntries(
  [...FILES_A_WITHHELD_RULE_SUGGESTS_A_REWRITE_IN, A_REWRITE_SUGGESTED_BESIDE].map(({ file, source }) => [file, source]),
)

function writtenFilesOf({ reported, fixedBeside }: EditorProject): ProjectFiles {
  return Object.fromEntries([...reported, ...fixedBeside].map(({ file, source }) => [file, source]))
}

function setUpEditorMerges(project: EditorProject, packageJson: ProjectFiles): EngineRun {
  return setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, project.rulesetSets, project.named)),
    { ...writtenFilesOf(project), ...packageJson },
    buildEditorBuild(),
  )
}

/** What fixing every file on save leaves, oxlint's fix-all first where the project lists oxlint, then ESLint's. */
function setUpFixesOnSave(run: EngineRun, project: EditorProject, { oxlint }: { readonly oxlint: boolean }): () => Record<string, string> {
  return setUpRunsBeforeTheSuite(async () => {
    const projectDir = run.projectDir()
    const files = Object.keys(writtenFilesOf(project))
    if (oxlint) {
      writeOxlintConfigFile(projectDir, FIX_RUN_OXLINT_CONFIG, run.emittedOxlintConfig())
      oxlintCliOutputIn(projectDir, ['-c', FIX_RUN_OXLINT_CONFIG, '--fix', ...files])
    }
    const eslint = new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: [...run.emittedEslintConfig()], fix: true })
    await ESLint.outputFixes(await eslint.lintFiles(files.map((file) => join(projectDir, file))))
    return textsOf(projectDir, files)
  })
}

function casesOf(rule: string, { reported }: EditorProject): readonly ReportedFile[] {
  return reported.filter((reportedFile) => reportedFile.rule === rule)
}

/** The rule under its ESLint ID, and under oxlint's code where oxlint has a version of it. */
function namesOf(rule: string): ReadonlySet<string> {
  return new Set([rule, ...catalog.oxlintRules.filter(({ id }) => id === rule).map(oxlintCodeOfRule)])
}

function eslintMessagesOf(run: EngineRun, file: string, rule: string): Linter.LintMessage[] {
  const projectDir = run.projectDir()
  return run
    .eslintResults()
    .filter(({ filePath }) => projectPathOf(filePath, projectDir) === file)
    .flatMap(({ messages }) => messages)
    .filter(({ ruleId }) => ruleId === rule)
}

function eslintReportsOf(run: EngineRun, file: string, rule: string): Array<ReportOnALine & { readonly offersAFix: boolean }> {
  return eslintMessagesOf(run, file, rule).map(({ line, fix }) => ({ file, line, offersAFix: fix !== undefined }))
}

function offeredIn({ fix, suggestions }: Readonly<Linter.LintMessage>): Offered {
  return { offersAFix: fix !== undefined, suggestsARewrite: suggestions !== undefined && suggestions.length > 0 }
}

function eslintOffersOf(run: EngineRun, { file, rule }: ReportedFile): Array<ReportOnALine & Offered> {
  return eslintMessagesOf(run, file, rule).map((message) => ({ file, line: message.line, ...offeredIn(message) }))
}

/** The rule alone, as its plugin ships it, in no merge of ours. */
function shippedPluginOffersOf({ file, source, rule }: ReportedFile): Array<ReportOnALine & Offered> {
  const prefix = pluginPrefixOf(rule)
  if (prefix === null) throw new Error(`${rule} is ESLint's own rule, in no plugin`)
  const config: Linter.Config[] = [
    {
      files: ['**/*.ts', '**/*.tsx'],
      languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { [prefix]: foundOr(eslintPlugins[prefix], `no plugin under ${prefix}`) },
      rules: { [rule]: 'error' },
    },
  ]
  return new Linter().verify(source, config, { filename: file }).map((message) => ({ file, line: message.line, ...offeredIn(message) }))
}

function setUpMergesOfFilesRewritesAreSuggestedIn(packageJson: ProjectFiles): EngineRun {
  return setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, QUALITY_RULESETS_BESIDE_JEST_DOM_TANSTACK_QUERY_AND_ZOD)),
    { ...FILES_REWRITES_ARE_SUGGESTED_IN, ...packageJson },
    buildEditorBuild(),
  )
}

/** Errors under either engine's name for the rule. */
function reportsInEitherEngine(run: EngineRun, file: string, rule: string): ReportOnALine[] {
  const names = namesOf(rule)
  return run
    .errorsOn(file)
    .filter(({ rule: name }) => name !== null && names.has(name))
    .map(({ line }) => ({ file, line }))
}

function textsAfterSaving(texts: Readonly<Record<string, string>>, { reported, fixedBeside }: EditorProject): ProjectTexts {
  return {
    withheld: Object.fromEntries(reported.map(({ file }) => [file, texts[file]])),
    beside: Object.fromEntries(fixedBeside.map(({ file }) => [file, texts[file]])),
  }
}

function textsAsWrittenAndFixed({ reported, fixedBeside }: EditorProject): ProjectTexts {
  return {
    withheld: Object.fromEntries(reported.map(({ file, source }) => [file, source])),
    beside: Object.fromEntries(fixedBeside.map(({ file, fixed }) => [file, fixed])),
  }
}

describe('the editor projects here', () => {
  it('report each rule whose fix check withholds, and no other', () => {
    const rules = EDITOR_PROJECTS.flatMap((project) => project.rules)

    expect({
      withheld: WITHHELD_FIXES.keys().toArray().toSorted(),
      withAFileReported: [...new Set(EDITOR_PROJECTS.flatMap(({ reported }) => reported.map(({ rule }) => rule)))].toSorted(),
    }).toStrictEqual({ withheld: rules.toSorted(), withAFileReported: rules.toSorted() })
  })
})

describe.each(EDITOR_PROJECTS)('the editor merge into an empty team ESLint config, in a project listing no oxlint, $rulesets listed', (project) => {
  const editor = setUpEditorMerges(project, LISTING_NO_OXLINT)
  const saved = setUpFixesOnSave(editor, project, { oxlint: false })

  it.each(project.rules)('reports %s on its line, and offers no fix for it', (rule) => {
    const cases = casesOf(rule, project)

    expect(cases.flatMap(({ file }) => eslintReportsOf(editor, file, rule))).toStrictEqual(cases.map(({ file, line }) => ({ file, line, offersAFix: false })))
  })

  it('leaves each of those files as written when every file is fixed on save, and fixes the files beside them', () => {
    expect(textsAfterSaving(saved(), project)).toStrictEqual(textsAsWrittenAndFixed(project))
  })
})

describe.each(EDITOR_PROJECTS)('the editor merges into empty team configs, in a project listing oxlint, $rulesets listed', (project) => {
  const editor = setUpEditorMerges(project, LISTING_OXLINT)
  const saved = setUpFixesOnSave(editor, project, { oxlint: true })

  it.each(project.rules)('reports %s once, on its line, and ESLint offers no fix for it', (rule) => {
    const cases = casesOf(rule, project)

    expect({
      reported: cases.flatMap(({ file }) => reportsInEitherEngine(editor, file, rule)),
      fixesOfferedByEslint: cases.flatMap(({ file }) => eslintReportsOf(editor, file, rule).filter(({ offersAFix }) => offersAFix)),
    }).toStrictEqual({ reported: cases.map(({ file, line }) => ({ file, line })), fixesOfferedByEslint: [] })
  })

  it('leaves each of those files as written when every file is fixed on save by both engines, and fixes the files beside them', () => {
    expect(textsAfterSaving(saved(), project)).toStrictEqual(textsAsWrittenAndFixed(project))
  })
})

describe('the plugins as shipped', () => {
  it.each([...FILES_A_WITHHELD_RULE_SUGGESTS_A_REWRITE_IN, SOURCE_A_WITHHELD_SUGGESTION_WOULD_CHANGE])(
    'report $rule on line $line of $file, suggesting a rewrite and offering no fix',
    (suggested) => {
      expect(shippedPluginOffersOf(suggested)).toStrictEqual([{ file: suggested.file, line: suggested.line, offersAFix: false, suggestsARewrite: true }])
    },
  )

  it.each(SOURCES_A_WITHHELD_FIX_WOULD_CHANGE)('report $rule on line $line of $file, offering a fix', (fixed) => {
    expect(shippedPluginOffersOf(fixed)).toStrictEqual([{ file: fixed.file, line: fixed.line, offersAFix: true, suggestsARewrite: false }])
  })
})

describe(`the editor merge into an empty team ESLint config, in a project listing no oxlint, ${NAMING_EACH_RULE_SHIPPED_OFF_WITH_ITS_FIX_WITHHELD.rulesets} listed`, () => {
  const editor = setUpEditorMerges(NAMING_EACH_RULE_SHIPPED_OFF_WITH_ITS_FIX_WITHHELD, LISTING_NO_OXLINT)
  const { file, line, rule } = SOURCE_A_WITHHELD_SUGGESTION_WOULD_CHANGE

  it(`reports ${rule} on line ${String(line)} of ${file}, and suggests no rewrite for it`, () => {
    expect(eslintOffersOf(editor, SOURCE_A_WITHHELD_SUGGESTION_WOULD_CHANGE)).toStrictEqual([{ file, line, offersAFix: false, suggestsARewrite: false }])
  })
})

describe('the editor merge into an empty team ESLint config, in a project listing no oxlint, the quality rulesets beside jest-dom listed', () => {
  const editor = setUpMergesOfFilesRewritesAreSuggestedIn(LISTING_NO_OXLINT)

  it.each(FILES_A_WITHHELD_RULE_SUGGESTS_A_REWRITE_IN)('reports $rule on line $line of $file, and suggests no rewrite for it', (suggested) => {
    const { file, line } = suggested

    expect(eslintOffersOf(editor, suggested)).toStrictEqual([{ file, line, offersAFix: false, suggestsARewrite: false }])
  })

  it('suggests the rewrite of a rule whose fix check does not withhold, on its line', () => {
    const { file, line, rule } = A_REWRITE_SUGGESTED_BESIDE

    expect({ withheld: WITHHELD_FIXES.has(rule), byEslint: eslintOffersOf(editor, A_REWRITE_SUGGESTED_BESIDE) }).toStrictEqual({
      withheld: false,
      byEslint: [{ file, line, offersAFix: false, suggestsARewrite: true }],
    })
  })
})

describe('the editor merges into empty team configs, in a project listing oxlint, the quality rulesets beside jest-dom listed', () => {
  const editor = setUpMergesOfFilesRewritesAreSuggestedIn(LISTING_OXLINT)

  it.each(FILES_A_WITHHELD_RULE_SUGGESTS_A_REWRITE_IN)('report $rule once, on line $line of $file, and ESLint suggests no rewrite for it', (suggested) => {
    const { file, line, rule } = suggested

    expect({ reported: reportsInEitherEngine(editor, file, rule), byEslint: eslintOffersOf(editor, suggested) }).toStrictEqual({
      reported: [{ file, line }],
      byEslint: [{ file, line, offersAFix: false, suggestsARewrite: false }],
    })
  })

  it('suggest the rewrite of a rule whose fix check does not withhold, on its line', () => {
    const { file, line, rule } = A_REWRITE_SUGGESTED_BESIDE

    expect({ withheld: WITHHELD_FIXES.has(rule), byEslint: eslintOffersOf(editor, A_REWRITE_SUGGESTED_BESIDE) }).toStrictEqual({
      withheld: false,
      byEslint: [{ file, line, offersAFix: false, suggestsARewrite: true }],
    })
  })
})
