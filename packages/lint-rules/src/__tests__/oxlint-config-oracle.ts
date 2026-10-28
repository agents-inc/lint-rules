import { matchesGlob } from 'node:path'
import type { OxlintConfig, OxlintEnv, OxlintOverride } from 'oxlint'
import { laidOver } from './laid-over.ts'

type Severity = 'off' | 'warn' | 'error'

/** With every config extended as an object merged in. */
type ConfigReadForAFile = Required<Pick<OxlintConfig, 'rules' | 'env' | 'overrides'>>

export type OxlintFileConfig = {
  readonly rules: Readonly<Record<string, unknown>>
  readonly env: OxlintEnv
}

/** An ignore pattern read as a .gitignore line. */
type IgnoreLine = { readonly glob: string; readonly isAnchored: boolean; readonly matchesFoldersOnly: boolean }

const SEVERITY_BY_SPELLING = new Map<unknown, Severity>([
  ['off', 'off'],
  ['allow', 'off'],
  [0, 'off'],
  ['warn', 'warn'],
  [1, 'warn'],
  ['error', 'error'],
  ['deny', 'error'],
  [2, 'error'],
])

const PATH_SEPARATOR = '/'
const FROM_THE_CONFIG_FOLDER = './'
const NEGATION = '!'
const ANY_FOLDERS = '**/'

/**
* The config oxlint 1.87 applies to a file: top-level rules and env, then each matching override in order, a
* later one winning. Globs are relative to the config. A config extended as an object merges in first, but for
* its root env; one extended by path is out of sight. Measured in oxlint-config-oracle.integration.test.ts.
*/
export function oxlintConfigForFile(config: Readonly<OxlintConfig>, file: string): OxlintFileConfig {
  const { rules, env, overrides } = withExtendedConfigsMergedIn(config)
  return overrides
    .filter((override) => doesOverrideApplyTo(override, file))
    .reduce<OxlintFileConfig>(
      (applied, override) => ({
        rules: { ...applied.rules, ...override.rules },
        env: { ...applied.env, ...override.env },
      }),
      { rules: { ...rules }, env: { ...env } },
    )
}

/** The last statement of the rule under any spelling given, top level first; undefined where none applies. */
export function oxlintEntryOfRuleFor(config: Readonly<OxlintConfig>, file: string, spellings: readonly string[]): unknown {
  const { rules, overrides } = withExtendedConfigsMergedIn(config)
  // An override may switch only env, and state no rule.
  const ruleMapsInOrder = [rules, ...overrides.filter((override) => doesOverrideApplyTo(override, file)).map(({ rules: overrideRules = {} }) => overrideRules)]
  const lastStatement = ruleMapsInOrder.flatMap((ruleMap) => Object.entries(ruleMap).filter(([key]) => spellings.includes(key))).at(-1)
  return lastStatement === undefined ? undefined : lastStatement[1]
}

export function oxlintSeverityFor(config: Readonly<OxlintConfig>, file: string, oxlintName: string): Severity | undefined {
  const entry = oxlintConfigForFile(config, file).rules[oxlintName]
  return entry === undefined ? undefined : severityOfOxlintEntry(entry)
}

/**
* oxlint reads each ignore pattern as a .gitignore line relative to the config: no slash but a trailing one
* matches that name in any folder, a trailing slash matches folders only, an earlier slash anchors it, and a
* matched folder leaves out every file under it. Negated patterns are refused: the oracle does not model them.
*/
export function isIgnoredByOxlintConfig({ ignorePatterns = [] }: Readonly<OxlintConfig>, file: string): boolean {
  return ignorePatterns.map(ignoreLineOf).some((line) => doesIgnoreLineMatch(line, file))
}

/** A glob with no slash matches that file name in any folder; `./` starts at the config's folder. */
function doesOxlintGlobMatch(glob: string, file: string): boolean {
  const fromTheConfigFolder = glob.startsWith(FROM_THE_CONFIG_FOLDER) ? glob.slice(FROM_THE_CONFIG_FOLDER.length) : glob
  return matchesGlob(file, fromTheConfigFolder.includes(PATH_SEPARATOR) ? fromTheConfigFolder : `${ANY_FOLDERS}${fromTheConfigFolder}`)
}

export function severityOfOxlintEntry(entry: unknown): Severity {
  const severity = SEVERITY_BY_SPELLING.get(Array.isArray(entry) ? entry[0] : entry)
  if (severity === undefined) {
    throw new Error(`oxlint reads a rule entry as a severity or [severity, ...options], not ${JSON.stringify(entry)}`)
  }
  return severity
}

function ignoreLineOf(pattern: string): IgnoreLine {
  if (pattern.startsWith(NEGATION)) throw new Error(`the oracle reads no negated ignore pattern, and was given ${pattern}`)
  const matchesFoldersOnly = pattern.endsWith(PATH_SEPARATOR)
  const withoutTheLastSlash = matchesFoldersOnly ? pattern.slice(0, -PATH_SEPARATOR.length) : pattern
  const isAnchored = withoutTheLastSlash.includes(PATH_SEPARATOR)
  const glob = withoutTheLastSlash.startsWith(PATH_SEPARATOR) ? withoutTheLastSlash.slice(PATH_SEPARATOR.length) : withoutTheLastSlash
  return { glob, isAnchored, matchesFoldersOnly }
}

function doesIgnoreLineMatch({ glob, isAnchored, matchesFoldersOnly }: IgnoreLine, file: string): boolean {
  const candidates = matchesFoldersOnly ? foldersHolding(file) : [...foldersHolding(file), file]
  return candidates.some((path) => matchesGlob(path, isAnchored ? glob : `${ANY_FOLDERS}${glob}`))
}

function foldersHolding(file: string): string[] {
  const segments = file.split(PATH_SEPARATOR).slice(0, -1)
  return segments.map((segment, index) => [...segments.slice(0, index), segment].join(PATH_SEPARATOR))
}

/**
* Extended configs' rules sit under the config's own, a later one's over an earlier's; their overrides come
* first, in order. Only the config's own root env stands.
*/
function withExtendedConfigsMergedIn(config: Readonly<OxlintConfig>): ConfigReadForAFile {
  const { rules = {}, env = {}, overrides = [], extends: extended = [] } = config
  const merged = extended.filter(isAnObject).map(withExtendedConfigsMergedIn)
  return {
    rules: laidOver<ConfigReadForAFile['rules']>({}, [...merged.map((each) => each.rules), rules]),
    env,
    overrides: [...merged.flatMap((each) => each.overrides), ...overrides],
  }
}

/** A JSON config's `extends` holds paths, which oxlint's types for a TS config refuse. */
function isAnObject(extended: OxlintConfig | string): extended is OxlintConfig {
  return typeof extended !== 'string'
}

function doesOverrideApplyTo({ files, excludeFiles = [] }: Readonly<OxlintOverride>, file: string): boolean {
  return files.some((glob) => doesOxlintGlobMatch(glob, file)) && excludeFiles.every((glob) => !doesOxlintGlobMatch(glob, file))
}
