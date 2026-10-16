import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ESLint, type Linter } from 'eslint'
import { afterAll, beforeAll } from 'vitest'
import { isRecord } from '../core/is-record.ts'
import { severityOfCalculatedEntry } from './calculated-rule-severity.ts'
import { projectPathOf } from './project-paths.ts'

/** One message ESLint reports: `ruleId` null for ESLint's own, a parse error or a directive warning. */
export type ReportedMessage = { readonly ruleId: string | null; readonly message: string }

/** ESLint's calculated rule entries for a file, by rule ID: none where no block sets a rule. */
export type CalculatedRules = Readonly<Record<string, unknown>>

/** A file ESLint would not lint at all with the config: a global ignore matches it, or no block's files do. */
export const NOT_LINTED = 'not linted'

/** A file's calculated rule entries, or NOT_LINTED. */
export type CalculatedRulesOrNotLinted = CalculatedRules | typeof NOT_LINTED

/** The rule ID of each message ESLint reports on a file, null for ESLint's own, by the file's path relative to the project. */
export type RuleIdsReportedByFile = Readonly<Record<string, readonly (string | null)[]>>

/** Every file path is relative to the oracle's temp dir, which is ESLint's cwd. */
export type EslintConfigOracle = {
  /** ESLint's merged config for the file, or undefined when ESLint would not lint it at all. */
  calculatedConfigFor: (config: Linter.Config[], file: string) => Promise<Linter.Config | undefined>
  /** As `calculatedConfigFor`, for a file ESLint lints: throws where it does not. */
  lintedConfigFor: (config: Linter.Config[], file: string) => Promise<Linter.Config>
  /** The settings ESLint calculates for the file: throws where it gives none, as no config holding our base block does. */
  settingsFor: (config: Linter.Config[], file: string) => Promise<Readonly<Record<string, unknown>>>
  /** The linterOptions ESLint calculates for the file: it leaves noInlineConfig out when no block sets it. Throws where it gives none. */
  linterOptionsFor: (config: Linter.Config[], file: string) => Promise<Linter.LinterOptions>
  /** As `calculatedConfigFor`, with ESLint run from the project directory given, as in `ruleSeverityInProjectFor`. */
  calculatedConfigInProjectFor: (projectDir: string, config: Linter.Config[], file: string) => Promise<Linter.Config | undefined>
  /** Each file's calculated rule entries, read by one ESLint: none where no block sets a rule, NOT_LINTED where ESLint lints no such file. */
  calculatedRulesOfEach: (config: Linter.Config[], files: readonly string[]) => Promise<Readonly<Record<string, CalculatedRulesOrNotLinted>>>
  /** The rule's entry as ESLint calculates it for the file, options filled in. */
  ruleEntryFor: (config: Linter.Config[], file: string, ruleId: string) => Promise<unknown>
  /** The rule's severity for the file, or undefined when no block sets it. */
  ruleSeverityFor: (
    config: Linter.Config[],
    file: string,
    ruleId: string,
  ) => Promise<Linter.StringSeverity | undefined>
  /**
   * As `ruleSeverityFor`, with ESLint run from the project directory given, as a team's
   * eslint.config.mjs beside its tsconfig is, the file relative to it: for a config whose paths are
   * absolute paths into that project.
   */
  ruleSeverityInProjectFor: (
    projectDir: string,
    config: Linter.Config[],
    file: string,
    ruleId: string,
  ) => Promise<Linter.StringSeverity | undefined>
  globalsFor: (config: Linter.Config[], file: string) => Promise<Readonly<Record<string, unknown>>>
  parserOptionsFor: (config: Linter.Config[], file: string) => Promise<Readonly<Record<string, unknown>>>
  isPathIgnored: (config: Linter.Config[], file: string) => Promise<boolean>
  /**
   * Each plugin namespace of the file's calculated config, by the entry ESLint's cache key holds for
   * it (`Config#toJSON`): `namespace:name@version` from the plugin's meta, or the namespace alone
   * where the plugin carries no name.
   */
  serializedPluginsFor: (config: Linter.Config[], file: string) => Promise<Readonly<Record<string, string>>>
  ruleIdsReportedOn: (config: Linter.Config[], source: string, file: string) => Promise<(string | null)[]>
  messagesReportedOn: (config: Linter.Config[], source: string, file: string) => Promise<ReportedMessage[]>
  /**
   * ESLint run from the project directory over `.`, as `eslint .` lints it: every file it lints,
   * with the files on disk and the type information a tsconfig of the project gives, and the rule
   * ID of each message reported on each, null for ESLint's own, a parse error included. A file a
   * global ignore matches, or no block's files match, is not among them.
   */
  ruleIdsReportedInProjectByFile: (projectDir: string, config: Linter.Config[]) => Promise<RuleIdsReportedByFile>
}

/** What ESLint's calculated config holds that its cache key is made from. */
type SerializableConfig = { readonly plugins: Readonly<Record<string, unknown>>; readonly toJSON: () => unknown }

const TEMP_DIR_PREFIX = 'lint-rules-eslint-oracle-'
const NAMESPACE_SEPARATOR = ':'

/**
 * ESLint's own merge of a config for one file, so a spec asserts what applies there rather than how
 * the blocks are laid out. Call it at the top of a test file: it registers that file's hooks, which
 * make the temp dir before the suite and remove it after.
 */
export function setUpEslintConfigOracle(): EslintConfigOracle {
  let tempDir: string | undefined

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), TEMP_DIR_PREFIX))
  })

  afterAll(async () => {
    await rm(suiteTempDir(), { recursive: true, force: true })
  })

  function suiteTempDir(): string {
    if (tempDir === undefined) throw new Error('the ESLint oracle was queried outside the suite that set it up')
    return tempDir
  }

  function eslintFor(config: Linter.Config[], cwd: string = suiteTempDir()): ESLint {
    return new ESLint({ cwd, overrideConfigFile: true, overrideConfig: config })
  }

  async function ruleSeverityInProjectFor(
    projectDir: string,
    config: Linter.Config[],
    file: string,
    ruleId: string,
  ): Promise<Linter.StringSeverity | undefined> {
    const calculated = await eslintFor(config, projectDir).calculateConfigForFile(file)
    if (calculated?.rules === undefined) throw new Error(`ESLint calculated no rules for ${file} in ${projectDir}`)
    return severityOfCalculatedEntry(calculated.rules[ruleId])
  }

  async function calculatedConfigFor(config: Linter.Config[], file: string): Promise<Linter.Config | undefined> {
    return eslintFor(config).calculateConfigForFile(file)
  }

  async function calculatedRulesOfEach(
    config: Linter.Config[],
    files: readonly string[],
  ): Promise<Readonly<Record<string, CalculatedRulesOrNotLinted>>> {
    const eslint = eslintFor(config)
    const byFile = await Promise.all(
      files.map(async (file): Promise<[string, CalculatedRulesOrNotLinted]> => {
        // Parse boundary: ESLint types the calculated config as any.
        const calculated: Linter.Config | undefined = await eslint.calculateConfigForFile(file)
        if (calculated === undefined) return [file, NOT_LINTED]
        // ESLint leaves `rules` out where no block that applies sets a rule.
        return [file, calculated.rules === undefined ? {} : { ...calculated.rules }]
      }),
    )
    return Object.fromEntries(byFile)
  }

  async function lintedConfigFor(config: Linter.Config[], file: string): Promise<Linter.Config> {
    const calculated = await calculatedConfigFor(config, file)
    if (calculated === undefined) throw new Error(`ESLint does not lint ${file}`)
    return calculated
  }

  async function ruleEntryFor(config: Linter.Config[], file: string, ruleId: string): Promise<unknown> {
    const { rules } = await lintedConfigFor(config, file)
    if (rules === undefined) throw new Error(`no rules apply to ${file}`)
    return rules[ruleId]
  }

  async function messagesReportedOn(config: Linter.Config[], source: string, file: string): Promise<ReportedMessage[]> {
    const results = await eslintFor(config).lintText(source, { filePath: join(suiteTempDir(), file) })
    return results.flatMap((result) => result.messages.map(({ ruleId, message }) => ({ ruleId, message })))
  }

  async function serializedPluginsFor(config: Linter.Config[], file: string): Promise<Readonly<Record<string, string>>> {
    // Parse boundary: ESLint types the calculated config as any.
    const calculated: unknown = await eslintFor(config).calculateConfigForFile(file)
    if (!isSerializableConfig(calculated)) throw new Error(`ESLint calculated no serializable config for ${file}`)
    const entries = serializedPluginEntriesOf(calculated.toJSON())
    return Object.fromEntries(
      Object.keys(calculated.plugins).map((namespace): [string, string] => [namespace, entryOfNamespace(entries, namespace)]),
    )
  }

  async function ruleIdsReportedInProjectByFile(projectDir: string, config: Linter.Config[]): Promise<RuleIdsReportedByFile> {
    const results = await eslintFor(config, projectDir).lintFiles(['.'])
    return Object.fromEntries(
      results.map((result): [string, (string | null)[]] => [
        projectPathOf(result.filePath, projectDir),
        result.messages.map(({ ruleId }) => ruleId),
      ]),
    )
  }

  return {
    calculatedConfigFor,
    lintedConfigFor,
    settingsFor: async (config, file) => {
      const { settings } = await lintedConfigFor(config, file)
      if (settings === undefined) throw new Error(`ESLint gives ${file} no settings`)
      return settings
    },
    linterOptionsFor: async (config, file) => {
      const { linterOptions } = await lintedConfigFor(config, file)
      if (linterOptions === undefined) throw new Error(`ESLint calculated no linterOptions for ${file}`)
      return linterOptions
    },
    calculatedConfigInProjectFor: async (projectDir, config, file) => eslintFor(config, projectDir).calculateConfigForFile(file),
    calculatedRulesOfEach,
    ruleEntryFor,
    ruleSeverityFor: async (config, file, ruleId) => severityOfCalculatedEntry(await ruleEntryFor(config, file, ruleId)),
    ruleSeverityInProjectFor,
    globalsFor: async (config, file) => {
      const globals = (await lintedConfigFor(config, file)).languageOptions?.['globals']
      if (!isRecord(globals)) throw new Error(`no globals apply to ${file}`)
      return globals
    },
    parserOptionsFor: async (config, file) => {
      const parserOptions = (await lintedConfigFor(config, file)).languageOptions?.['parserOptions']
      if (!isRecord(parserOptions)) throw new Error(`no parser options apply to ${file}`)
      return parserOptions
    },
    isPathIgnored: async (config, file) => eslintFor(config).isPathIgnored(file),
    serializedPluginsFor,
    ruleIdsReportedOn: async (config, source, file) =>
      (await messagesReportedOn(config, source, file)).map((message) => message.ruleId),
    messagesReportedOn,
    ruleIdsReportedInProjectByFile,
  }
}

function isSerializableConfig(value: unknown): value is SerializableConfig {
  return isRecord(value) && isRecord(value['plugins']) && typeof value['toJSON'] === 'function'
}

function serializedPluginEntriesOf(serialized: unknown): string[] {
  if (!isRecord(serialized) || !Array.isArray(serialized['plugins'])) throw new Error('ESLint serialized a config without plugins')
  const entries: unknown[] = serialized['plugins']
  return entries.map((entry) => {
    if (typeof entry !== 'string') throw new Error(`ESLint serialized a plugin as ${JSON.stringify(entry)}, not a string`)
    return entry
  })
}

/** The namespace alone, or the namespace and the plugin's name: `react` never matches `react-hooks:…`. */
function entryOfNamespace(entries: readonly string[], namespace: string): string {
  const entry = entries.find((candidate) => candidate === namespace || candidate.startsWith(`${namespace}${NAMESPACE_SEPARATOR}`))
  if (entry === undefined) throw new Error(`ESLint serialized no plugin under ${namespace}`)
  return entry
}
