import { matchesGlob } from 'node:path'
import type { OxlintConfig, OxlintEnv, OxlintOverride } from 'oxlint'

type Severity = 'off' | 'warn' | 'error'

/** The keys of a config the oracle reads, with every config it extends as an object merged in. */
type ConfigReadForAFile = Required<Pick<OxlintConfig, 'rules' | 'env' | 'overrides'>>

/** What oxlint applies to one file: rule entries keyed by oxlint name, and the env switches. */
export type OxlintFileConfig = {
  readonly rules: Readonly<Record<string, unknown>>
  readonly env: OxlintEnv
}

/** An ignore pattern read as a .gitignore line: the glob, whether it holds from the config's folder only, and whether it matches folders only. */
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
 * The config oxlint applies to a file, read the way oxlint 1.87 reads it: the top-level rules and
 * env, then each override whose `files` match the file and whose `excludeFiles` do not, in order,
 * so a later override wins. Paths are relative to the config, as oxlint resolves override globs. A
 * config extended as an object is merged in first, but for its root env, which reaches no file; one
 * extended by path is out of sight. All measured in oxlint-config-oracle.integration.test.ts.
 */
export function oxlintConfigForFile(config: OxlintConfig, file: string): OxlintFileConfig {
  const { rules = {}, env = {}, overrides = [] } = withExtendedConfigsMergedIn(config)
  return overrides
    .filter((override) => overrideAppliesTo(override, file))
    .reduce<OxlintFileConfig>(
      (applied, override) => ({
        rules: { ...applied.rules, ...override.rules },
        env: { ...applied.env, ...override.env },
      }),
      { rules: { ...rules }, env: { ...env } },
    )
}

/**
 * The entry oxlint applies to a rule in a file, the rule written under any of the spellings given,
 * each of which oxlint reads as that rule: the last statement of it, the top level's first, then
 * each override that applies, in order. Undefined where no statement of it applies.
 */
export function oxlintEntryOfRuleFor(config: OxlintConfig, file: string, spellings: readonly string[]): unknown {
  const { rules = {}, overrides = [] } = withExtendedConfigsMergedIn(config)
  // An override may switch only env, and state no rule.
  const ruleMapsInOrder = [rules, ...overrides.filter((override) => overrideAppliesTo(override, file)).map(({ rules: overrideRules = {} }) => overrideRules)]
  const lastStatement = ruleMapsInOrder.flatMap((ruleMap) => Object.entries(ruleMap).filter(([key]) => spellings.includes(key))).at(-1)
  return lastStatement === undefined ? undefined : lastStatement[1]
}

/** The rule's severity in the file, or undefined when neither the top level nor an override sets it. */
export function oxlintSeverityFor(config: OxlintConfig, file: string, oxlintName: string): Severity | undefined {
  const entry = oxlintConfigForFile(config, file).rules[oxlintName]
  return entry === undefined ? undefined : severityOfOxlintEntry(entry)
}

/**
 * Whether the config's `ignorePatterns` match the file, so oxlint lints it with none of the config's
 * rules. oxlint reads each pattern as a .gitignore line, relative to the config: a pattern with no
 * slash but a last one matches a folder or file of that name in any folder, a last slash matches
 * folders only, a slash before that ties it to the config's folder, and a folder matched leaves out
 * every file under it. A negated pattern is refused, as the oracle does not model it.
 */
export function isIgnoredByOxlintConfig({ ignorePatterns = [] }: OxlintConfig, file: string): boolean {
  return ignorePatterns.map(ignoreLineOf).some((line) => ignoreLineMatches(line, file))
}

/**
 * Whether one of oxlint's override globs matches the file: a glob with no slash matches a file of
 * that name in any folder, and `./` starts at the config's folder.
 */
export function oxlintGlobMatches(glob: string, file: string): boolean {
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

/** Whether the line matches the file, or a folder the file is under. */
function ignoreLineMatches({ glob, isAnchored, matchesFoldersOnly }: IgnoreLine, file: string): boolean {
  const candidates = matchesFoldersOnly ? foldersHolding(file) : [...foldersHolding(file), file]
  return candidates.some((path) => matchesGlob(path, isAnchored ? glob : `${ANY_FOLDERS}${glob}`))
}

/** Each folder the file is under, outermost first: `src`, then `src/deep`, for `src/deep/a.js`. */
function foldersHolding(file: string): string[] {
  const segments = file.split(PATH_SEPARATOR).slice(0, -1)
  return segments.map((segment, index) => [...segments.slice(0, index), segment].join(PATH_SEPARATOR))
}

/**
 * The config with each config it extends as an object merged in, as oxlint merges them: their top-level
 * rules, a later config's over an earlier's, under the config's own; their overrides, env included,
 * in order, before the config's own. Only the config's own root env stands.
 */
function withExtendedConfigsMergedIn(config: OxlintConfig): ConfigReadForAFile {
  const { rules = {}, env = {}, overrides = [], extends: extended = [] } = config
  const merged = extended.filter(isAnObject).map(withExtendedConfigsMergedIn)
  return {
    rules: { ...merged.reduce<ConfigReadForAFile['rules']>((under, each) => ({ ...under, ...each.rules }), {}), ...rules },
    env,
    overrides: [...merged.flatMap((each) => each.overrides), ...overrides],
  }
}

/** A JSON config's `extends` holds paths, which oxlint's types for a TS config refuse. */
function isAnObject(extended: OxlintConfig | string): extended is OxlintConfig {
  return typeof extended !== 'string'
}

function overrideAppliesTo({ files, excludeFiles = [] }: OxlintOverride, file: string): boolean {
  return files.some((glob) => oxlintGlobMatches(glob, file)) && !excludeFiles.some((glob) => oxlintGlobMatches(glob, file))
}
