import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { ESLint, type Linter } from 'eslint'
import typescriptEslint from 'typescript-eslint'

import type { Catalog, Engine, RuleRoute } from '../catalog.ts'
import { eslintPlugins } from '../eslint-plugins.ts'
import { isObject } from '../is-object.ts'
import { OXLINT_BIN } from './oxlint-print-config.ts'

// One rule at a time, on the files of a case, through the real ESLint or the real oxlint: what each
// engine made of each file. Read by changed-settings.integration.test.ts.

/** A file a case writes: its path from the project's root, its source, and the one engine that can read it, where only one can. */
export type CaseFile = { readonly path: string; readonly source: string; readonly onlyIn?: Engine }

/**
 * What an engine made of a file with the rule on: the rule's finding, nothing, or no lint at all (a
 * parse error, a config the engine refused, a file no config block matches). The last is never the
 * rule staying silent.
 */
export type FileOutcome = 'reports' | 'silent' | 'not linted'

/** What a rule runs with: its options, the only files it runs on, and the files it skips. */
export type RuleSettings = {
  readonly options: readonly unknown[]
  readonly files: readonly string[] | null
  readonly ignores: readonly string[] | null
}

/** One rule ESLint runs on some of the files. */
type EslintRuleBlock = { readonly ruleId: string; readonly settings: RuleSettings }

const ERROR = 'error'
const OXLINT_CATEGORIES = ['correctness', 'suspicious', 'pedantic', 'style', 'nursery', 'restriction', 'perf']
const ALL_SOURCE_FILES = '**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'
const JS_FILES = '**/*.{js,jsx,mjs,cjs}'
const TS_FILES = '**/*.{ts,tsx,mts,cts}'
// eslint-plugin-react warns on every run without a React version, and reads its version-gated
// checks (react/no-unsafe's) from it.
const REACT_VERSION = '19.0'

/**
 * The settings a shipped rule runs with: its own, or, for a rule `allowSuppressions` decides, the
 * ones it runs with where suppressions are allowed.
 */
export function shippedSettingsOf(route: RuleRoute): RuleSettings {
  const { shipped } = route
  if (shipped === null) throw new Error(`${route.id} is not shipped`)
  const { options, files, ignores } = shipped
  if (!('whenSuppressions' in shipped)) return { options, files, ignores }
  const { allowed } = shipped.whenSuppressions
  if (allowed === 'off') throw new Error(`${route.id} is off where suppressions are allowed`)
  return { options: allowed.options, files, ignores }
}

/** Writes each case file under the project's root: oxlint lints them from disk, and ESLint types them from there. */
export async function writeCaseFiles(projectDir: string, files: readonly CaseFile[]): Promise<void> {
  await Promise.all(
    files.map(async ({ path, source }) => {
      await mkdir(dirname(join(projectDir, path)), { recursive: true })
      await writeFile(join(projectDir, path), source)
    }),
  )
}

/** A rule we do not ship, as a team or a stand-in turns it on: no options, every file. */
export const UNSHIPPED_RULE_SETTINGS: RuleSettings = { options: [], files: null, ignores: null }

/**
 * The rules ESLint runs for a route: the route's own rule, except that without oxlint ESLint runs a
 * moved core rule's current typescript-eslint extension on TS files in its place, as it does beside
 * no oxlint (questions.md #39).
 */
export function eslintBlocksOf(route: RuleRoute, settings: RuleSettings, { rules, coreRuleExtensions }: Pick<Catalog, 'rules' | 'coreRuleExtensions'>): readonly EslintRuleBlock[] {
  const extensions = coreRuleExtensions.get(route.id)
  if (route.engine === 'eslint' || extensions === undefined) return [{ ruleId: route.id, settings }]
  const currentExtensions = extensions.filter((extension) => rules.has(extension))
  const [extension] = currentExtensions
  if (extension === undefined) return [{ ruleId: route.id, settings }]
  if (currentExtensions.length > 1) throw new Error(`${route.id} has more than one current typescript-eslint extension: ${currentExtensions.join(', ')}`)
  if (settings.files !== null) throw new Error(`${route.id} runs in oxlint but ships files of its own`)
  return [
    { ruleId: route.id, settings: { ...settings, files: [JS_FILES] } },
    { ruleId: extension, settings: { ...settings, files: [TS_FILES] } },
  ]
}

/**
 * ESLint over the files, from the project's root, with each block's rule on in its files but its
 * ignores, and type information where `typed` says: each file's outcome.
 */
export async function eslintOutcomesOf(
  projectDir: string,
  blocks: readonly EslintRuleBlock[],
  files: readonly CaseFile[],
  { typed }: { readonly typed: boolean },
): Promise<ReadonlyMap<string, FileOutcome>> {
  const eslint = new ESLint({
    cwd: projectDir,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: [ALL_SOURCE_FILES],
        languageOptions: {
          parser: typescriptEslint.parser,
          parserOptions: typed ? { projectService: true, tsconfigRootDir: projectDir } : { ecmaFeatures: { jsx: true } },
        },
        plugins: eslintPlugins,
        settings: { react: { version: REACT_VERSION } },
      },
      ...blocks.map(configBlockOf),
    ],
  })
  const ruleIds = blocks.map(({ ruleId }) => ruleId)
  const outcomes = await Promise.all(
    files.map(async ({ path, source }): Promise<[string, FileOutcome]> => {
      const [result] = await eslint.lintText(source, { filePath: join(projectDir, path) })
      if (result === undefined) throw new Error(`ESLint returned no result for ${path}`)
      return [path, eslintOutcomeOf(result.messages, ruleIds)]
    }),
  )
  return new Map(outcomes)
}

/**
 * oxlint over the files, written by writeCaseFiles, from the project's root, with the rule on under
 * oxlint's name and off in the files its ignores name, as the oxlint build writes it: each file's
 * outcome.
 */
export function oxlintOutcomesOf(
  projectDir: string,
  configFile: string,
  { oxlintName, oxlintPlugin }: { readonly oxlintName: string; readonly oxlintPlugin: string },
  { options, files, ignores }: RuleSettings,
  caseFiles: readonly CaseFile[],
): ReadonlyMap<string, FileOutcome> {
  if (files !== null) throw new Error(`${oxlintName} ships files of its own, which the oxlint build refuses`)
  const config = {
    plugins: [oxlintPlugin],
    categories: Object.fromEntries(OXLINT_CATEGORIES.map((category) => [category, 'off'])),
    rules: { [oxlintName]: [ERROR, ...options] },
    overrides: ignores === null ? [] : [{ files: ignores, rules: { [oxlintName]: 'off' } }],
  }
  writeFileSync(join(projectDir, configFile), JSON.stringify(config))
  const paths = caseFiles.map(({ path }) => path)
  const { stdout } = spawnSync(process.execPath, [OXLINT_BIN, '-c', configFile, '-f', 'json', ...paths], { cwd: projectDir, encoding: 'utf8' })
  // oxlint prints something other than JSON when it cannot load the config.
  if (!stdout.trimStart().startsWith('{')) return new Map(paths.map((path) => [path, 'not linted']))
  const diagnostics = diagnosticsIn(stdout)
  return new Map(paths.map((path) => [path, oxlintOutcomeOf(diagnostics.filter(({ filename }) => filename === path))]))
}

function configBlockOf({ ruleId, settings: { options, files, ignores } }: EslintRuleBlock): Linter.Config {
  return {
    files: [...(files ?? [ALL_SOURCE_FILES])],
    ignores: [...(ignores ?? [])],
    rules: { [ruleId]: [ERROR, ...options] },
  }
}

/** A message with no rule is ESLint not linting the file: a parse error, or no config block matching it. */
function eslintOutcomeOf(messages: readonly Linter.LintMessage[], ruleIds: readonly string[]): FileOutcome {
  if (messages.some(({ ruleId }) => ruleId === null)) return 'not linted'
  return messages.some(({ ruleId }) => ruleId !== null && ruleIds.includes(ruleId)) ? 'reports' : 'silent'
}

/** A diagnostic in oxlint's JSON report: a rule's finding links to the rule's page, a parse error links nowhere. */
type OxlintDiagnostic = { readonly filename: string; readonly url: string | null }

/** Only one rule is on, so any linked diagnostic in the file is its finding. */
function oxlintOutcomeOf(diagnostics: readonly OxlintDiagnostic[]): FileOutcome {
  if (diagnostics.some(({ url }) => url === null)) return 'not linted'
  return diagnostics.length > 0 ? 'reports' : 'silent'
}

/** The diagnostics of oxlint's JSON report. Parse boundary: oxlint's output. */
function diagnosticsIn(stdout: string): readonly OxlintDiagnostic[] {
  const report: unknown = JSON.parse(stdout)
  if (!isObject(report) || !('diagnostics' in report) || !Array.isArray(report.diagnostics)) {
    throw new Error(`oxlint's JSON report has no diagnostics: ${stdout}`)
  }
  return report.diagnostics.map(diagnosticOf)
}

function diagnosticOf(diagnostic: unknown): OxlintDiagnostic {
  if (!isObject(diagnostic) || !('filename' in diagnostic) || typeof diagnostic.filename !== 'string') {
    throw new Error(`oxlint reported a diagnostic with no file: ${JSON.stringify(diagnostic)}`)
  }
  const url = 'url' in diagnostic && typeof diagnostic.url === 'string' ? diagnostic.url : null
  return { filename: diagnostic.filename, url }
}
