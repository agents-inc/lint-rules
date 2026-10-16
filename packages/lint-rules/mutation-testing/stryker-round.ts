import { readFile } from 'node:fs/promises'
import { extname, matchesGlob } from 'node:path'
import { pathToFileURL } from 'node:url'

// What scripts/mutate-changed-lines.mts decides about a round: which Stryker configs it runs, which
// changed files each config mutates, and the exit code of the whole round.

/** Each package's Stryker config, relative to the repo root: a round runs each in turn. */
export const PACKAGE_STRYKER_CONFIGS: readonly string[] = [
  'stryker.config.json',
  'stryker.rule-data.config.mjs',
  'stryker.eslint-plugin-house.config.mjs',
]

/** The part of a Stryker config's options a round reads. */
export type StrykerOptions = { readonly mutate?: unknown }

/** The configs a round runs, and the arguments it passes on to Stryker with each. */
export type Round = { readonly configFiles: readonly string[]; readonly strykerArguments: readonly string[] }

const OPTION_PREFIX = '-'
const NEGATION = '!'
const STRYKER_SUCCEEDED = 0

const OPTIONS_LOADERS: Readonly<Record<string, (configPath: string) => Promise<StrykerOptions | undefined>>> = {
  // Parse boundary: a JSON config file.
  '.json': async (configPath) => JSON.parse(await readFile(configPath, 'utf8')) as StrykerOptions,
  '.mjs': async (configPath) => {
    // Parse boundary: the options a JavaScript config file exports.
    const configModule = (await import(pathToFileURL(configPath).href)) as { readonly default?: StrykerOptions }
    return configModule.default
  },
}

/**
 * Stryker takes its config file as the one argument that is no option. Given first, it names the only
 * config the round runs; otherwise the round runs every package's config. The other arguments go on
 * to Stryker.
 */
export function configsOfTheRound(argumentsGiven: readonly string[]): Round {
  const [first, ...rest] = argumentsGiven
  if (first === undefined || first.startsWith(OPTION_PREFIX)) {
    return { configFiles: PACKAGE_STRYKER_CONFIGS, strykerArguments: argumentsGiven }
  }
  return { configFiles: [first], strykerArguments: rest }
}

/** The `mutate` patterns of the config file at `configPath`, a `.json` or `.mjs` file. */
export async function mutatePatternsOf(configPath: string): Promise<readonly string[]> {
  const loadOptions = OPTIONS_LOADERS[extname(configPath)]
  if (loadOptions === undefined) {
    throw new Error(`${configPath} is no config file a round reads: give a .json or .mjs Stryker config`)
  }
  return mutatePatternsIn(await loadOptions(configPath), configPath)
}

/** The `mutate` patterns of a config's options, which must list them. */
export function mutatePatternsIn(options: StrykerOptions | undefined, configPath: string): readonly string[] {
  const mutate = options?.mutate
  if (!Array.isArray(mutate) || !mutate.every((pattern) => typeof pattern === 'string')) {
    throw new Error(`${configPath} lists no "mutate" patterns`)
  }
  return mutate
}

/** Whether a config's `mutate` patterns take `file`: one pattern matches it and no `!` pattern does. */
export function isMutated(file: string, patterns: readonly string[]): boolean {
  const matches = (pattern: string): boolean => matchesGlob(file, pattern)
  const included = patterns.filter((pattern) => !pattern.startsWith(NEGATION)).some(matches)
  const excluded = patterns
    .filter((pattern) => pattern.startsWith(NEGATION))
    .some((pattern) => matches(pattern.slice(NEGATION.length)))
  return included && !excluded
}

/** The exit code of the round's first run that failed, or success when none did. */
export function exitCodeOfTheRound(exitCodes: readonly number[]): number {
  return exitCodes.find((exitCode) => exitCode !== STRYKER_SUCCEEDED) ?? STRYKER_SUCCEEDED
}
