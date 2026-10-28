import { join } from 'node:path'
import { ESLint, type Linter } from 'eslint'
import { isRecord } from '../core/is-record.ts'
import { severityOfCalculatedEntry } from './calculated-rule-severity.ts'
import { projectPathOf } from './project-paths.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'

/** One message ESLint reports: `ruleId` null for ESLint's own, a parse error or a directive warning. */
type ReportedMessage = { readonly ruleId: string | null; readonly message: string }

/** ESLint's calculated rule entries for a file, by rule ID: none where no block sets a rule. */
export type CalculatedRules = Readonly<Record<string, unknown>>

/** A file ESLint would not lint at all with the config: a global ignore matches it, or no block's files do. */
export const NOT_LINTED = 'not linted'

export type CalculatedRulesOrNotLinted = CalculatedRules | typeof NOT_LINTED

/** By the file's path relative to the project; null for ESLint's own messages. */
export type RuleIdsReportedByFile = Readonly<Record<string, ReadonlyArray<string | null>>>

/** Every file path is relative to the oracle's temp dir, which is ESLint's cwd. */
export type EslintConfigOracle = {
  calculatedConfigFor: (config: readonly Linter.Config[], file: string) => Promise<Linter.Config | undefined>
  /** As `calculatedConfigFor`, for a file ESLint lints: throws where it does not. */
  lintedConfigFor: (config: readonly Linter.Config[], file: string) => Promise<Linter.Config>
  /** Throws where ESLint gives none, as for a config without our base block. */
  settingsFor: (config: readonly Linter.Config[], file: string) => Promise<Readonly<Record<string, unknown>>>
  /** ESLint leaves noInlineConfig out when no block sets it. Throws where it gives none. */
  linterOptionsFor: (config: readonly Linter.Config[], file: string) => Promise<Linter.LinterOptions>
  /** With ESLint run from the project directory given. */
  calculatedConfigInProjectFor: (projectDir: string, config: readonly Linter.Config[], file: string) => Promise<Linter.Config | undefined>
  calculatedRulesOfEach: (config: readonly Linter.Config[], files: readonly string[]) => Promise<Readonly<Record<string, CalculatedRulesOrNotLinted>>>
  /** The rule's entry as ESLint calculates it for the file, options filled in. */
  ruleEntryFor: (config: readonly Linter.Config[], file: string, ruleId: string) => Promise<unknown>
  ruleSeverityFor: (
    config: readonly Linter.Config[],
    file: string,
    ruleId: string,
  ) => Promise<Linter.StringSeverity | undefined>
  /** ESLint run from the project directory, as a team's eslint.config.mjs is, for configs with absolute paths into it. */
  ruleSeverityInProjectFor: (
    projectDir: string,
    config: readonly Linter.Config[],
    file: string,
    ruleId: string,
  ) => Promise<Linter.StringSeverity | undefined>
  globalsFor: (config: readonly Linter.Config[], file: string) => Promise<Readonly<Record<string, unknown>>>
  parserOptionsFor: (config: readonly Linter.Config[], file: string) => Promise<Readonly<Record<string, unknown>>>
  isPathIgnored: (config: readonly Linter.Config[], file: string) => Promise<boolean>
  /** By the entry ESLint's cache key holds (`Config#toJSON`): `namespace:name@version`, or the namespace where the plugin has no name. */
  serializedPluginsFor: (config: readonly Linter.Config[], file: string) => Promise<Readonly<Record<string, string>>>
  ruleIdsReportedOn: (config: readonly Linter.Config[], source: string, file: string) => Promise<Array<string | null>>
  messagesReportedOn: (config: readonly Linter.Config[], source: string, file: string) => Promise<ReportedMessage[]>
  /** `eslint .` from the project directory, with type information: each linted file's rule IDs, null for ESLint's own. */
  ruleIdsReportedInProjectByFile: (projectDir: string, config: readonly Linter.Config[]) => Promise<RuleIdsReportedByFile>
}

type SerializableConfig = { readonly plugins: Readonly<Record<string, unknown>>; readonly toJSON: () => unknown }

const NAMESPACE_SEPARATOR = ':'
// A folder made, which takes no time worth a run's.
const ITS_FOLDER: RunsBeforeTheSuiteOptions = { timeoutMs: 10_000, whatFailed: 'the ESLint oracle could not make its folder before the suite' }

/** ESLint's own merge for one file. Registers hooks: call it at the top of a test file. */
export function setUpEslintConfigOracle(): EslintConfigOracle {
  const suiteTempDir = setUpRunsBeforeTheSuite((tempProjects) => tempProjects.create({}), ITS_FOLDER)

  function eslintFor(config: readonly Linter.Config[], cwd: string = suiteTempDir()): ESLint {
    return new ESLint({ cwd, overrideConfigFile: true, overrideConfig: [...config] })
  }

  async function ruleSeverityInProjectFor(
    projectDir: string,
    config: readonly Linter.Config[],
    file: string,
    ruleId: string,
  ): Promise<Linter.StringSeverity | undefined> {
    const calculated = await calculatedConfigOf(eslintFor(config, projectDir), file)
    if (calculated?.rules === undefined) throw new Error(`ESLint calculated no rules for ${file} in ${projectDir}`)
    return severityOfCalculatedEntry(calculated.rules[ruleId])
  }

  async function calculatedConfigFor(config: readonly Linter.Config[], file: string): Promise<Linter.Config | undefined> {
    return calculatedConfigOf(eslintFor(config), file)
  }

  async function calculatedRulesOfEach(
    config: readonly Linter.Config[],
    files: readonly string[],
  ): Promise<Readonly<Record<string, CalculatedRulesOrNotLinted>>> {
    const eslint = eslintFor(config)
    const byFile = await Promise.all(
      files.map(async (file): Promise<[string, CalculatedRulesOrNotLinted]> => {
        const calculated = await calculatedConfigOf(eslint, file)
        if (calculated === undefined) return [file, NOT_LINTED]
        // ESLint leaves `rules` out where no block that applies sets a rule.
        return [file, calculated.rules === undefined ? {} : { ...calculated.rules }]
      }),
    )
    return Object.fromEntries(byFile)
  }

  async function lintedConfigFor(config: readonly Linter.Config[], file: string): Promise<Linter.Config> {
    const calculated = await calculatedConfigFor(config, file)
    if (calculated === undefined) throw new Error(`ESLint does not lint ${file}`)
    return calculated
  }

  async function ruleEntryFor(config: readonly Linter.Config[], file: string, ruleId: string): Promise<unknown> {
    const { rules } = await lintedConfigFor(config, file)
    if (rules === undefined) throw new Error(`no rules apply to ${file}`)
    return rules[ruleId]
  }

  async function messagesReportedOn(config: readonly Linter.Config[], source: string, file: string): Promise<ReportedMessage[]> {
    const results = await eslintFor(config).lintText(source, { filePath: join(suiteTempDir(), file) })
    return results.flatMap((result) => result.messages.map(({ ruleId, message }) => ({ ruleId, message })))
  }

  async function serializedPluginsFor(config: readonly Linter.Config[], file: string): Promise<Readonly<Record<string, string>>> {
    // Parse boundary: ESLint types the calculated config as any.
    const calculated: unknown = await eslintFor(config).calculateConfigForFile(file)
    if (!isSerializableConfig(calculated)) throw new Error(`ESLint calculated no serializable config for ${file}`)
    const entries = serializedPluginEntriesOf(calculated.toJSON())
    return Object.fromEntries(
      Object.keys(calculated.plugins).map((namespace): [string, string] => [namespace, entryOfNamespace(entries, namespace)]),
    )
  }

  async function ruleIdsReportedInProjectByFile(projectDir: string, config: readonly Linter.Config[]): Promise<RuleIdsReportedByFile> {
    const results = await eslintFor(config, projectDir).lintFiles(['.'])
    return Object.fromEntries(
      results.map((result): [string, Array<string | null>] => [
        projectPathOf(result.filePath, projectDir),
        result.messages.map(({ ruleId }) => ruleId),
      ]),
    )
  }

  return {
    calculatedConfigFor,
    lintedConfigFor,
    async settingsFor(config, file) {
      const { settings } = await lintedConfigFor(config, file)
      if (settings === undefined) throw new Error(`ESLint gives ${file} no settings`)
      return settings
    },
    async linterOptionsFor(config, file) {
      const { linterOptions } = await lintedConfigFor(config, file)
      if (linterOptions === undefined) throw new Error(`ESLint calculated no linterOptions for ${file}`)
      return linterOptions
    },
    async calculatedConfigInProjectFor(projectDir, config, file) {
      return calculatedConfigOf(eslintFor(config, projectDir), file)
    },
    calculatedRulesOfEach,
    ruleEntryFor,
    async ruleSeverityFor(config, file, ruleId) {
      return severityOfCalculatedEntry(await ruleEntryFor(config, file, ruleId))
    },
    ruleSeverityInProjectFor,
    async globalsFor(config, file) {
      const globals = (await lintedConfigFor(config, file)).languageOptions?.['globals']
      if (!isRecord(globals)) throw new Error(`no globals apply to ${file}`)
      return globals
    },
    async parserOptionsFor(config, file) {
      const parserOptions = (await lintedConfigFor(config, file)).languageOptions?.['parserOptions']
      if (!isRecord(parserOptions)) throw new Error(`no parser options apply to ${file}`)
      return parserOptions
    },
    async isPathIgnored(config, file) {
      return eslintFor(config).isPathIgnored(file)
    },
    serializedPluginsFor,
    async ruleIdsReportedOn(config, source, file) {
      return (await messagesReportedOn(config, source, file)).map((message) => message.ruleId)
    },
    messagesReportedOn,
    ruleIdsReportedInProjectByFile,
  }
}

/** Parse boundary: ESLint types the config it calculates as any, and gives undefined for a file it would not lint. */
async function calculatedConfigOf(eslint: ESLint, file: string): Promise<Linter.Config | undefined> {
  const calculated: unknown = await eslint.calculateConfigForFile(file)
  if (calculated === undefined || isCalculatedConfig(calculated)) return calculated
  throw new TypeError(`ESLint calculated a ${typeof calculated} for ${file}, not a config`)
}

// Every field of a calculated config is optional, and each caller reads the field it asked for: an object is one.
function isCalculatedConfig(value: unknown): value is Linter.Config {
  return isRecord(value)
}

function isSerializableConfig(value: unknown): value is SerializableConfig {
  return isRecord(value) && isRecord(value['plugins']) && typeof value['toJSON'] === 'function'
}

function serializedPluginEntriesOf(serialized: unknown): string[] {
  if (!isRecord(serialized) || !Array.isArray(serialized['plugins'])) throw new Error('ESLint serialized a config without plugins')
  const entries: unknown[] = serialized['plugins']
  return entries.map((entry) => {
    if (typeof entry !== 'string') throw new TypeError(`ESLint serialized a plugin as ${JSON.stringify(entry)}, not a string`)
    return entry
  })
}

/** The namespace alone, or the namespace and the plugin's name: `react` never matches `react-hooks:…`. */
function entryOfNamespace(entries: readonly string[], namespace: string): string {
  const entry = entries.find((candidate) => candidate === namespace || candidate.startsWith(`${namespace}${NAMESPACE_SEPARATOR}`))
  if (entry === undefined) throw new Error(`ESLint serialized no plugin under ${namespace}`)
  return entry
}
