import { readFile } from 'node:fs/promises'
import { extname, matchesGlob } from 'node:path'
import { pathToFileURL } from 'node:url'

export const PACKAGE_STRYKER_CONFIGS: readonly string[] = [
  'stryker.config.json',
  'stryker.rule-data.config.mjs',
  'stryker.eslint-plugin-house.config.mjs',
]

export type StrykerOptions = { readonly mutate?: unknown }

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

/** A config file given first (Stryker's one non-option argument) is the only one the round runs. */
export function configsOfTheRound(argumentsGiven: readonly string[]): Round {
  const [first, ...rest] = argumentsGiven
  if (first === undefined || first.startsWith(OPTION_PREFIX)) {
    return { configFiles: PACKAGE_STRYKER_CONFIGS, strykerArguments: argumentsGiven }
  }
  return { configFiles: [first], strykerArguments: rest }
}

export async function mutatePatternsOf(configPath: string): Promise<readonly string[]> {
  const loadOptions = OPTIONS_LOADERS[extname(configPath)]
  if (loadOptions === undefined) {
    throw new Error(`${configPath} is no config file a round reads: give a .json or .mjs Stryker config`)
  }
  return mutatePatternsIn(await loadOptions(configPath), configPath)
}

export function mutatePatternsIn(options: StrykerOptions | undefined, configPath: string): readonly string[] {
  const mutate = options?.mutate
  if (!Array.isArray(mutate) || !mutate.every((pattern) => typeof pattern === 'string')) {
    throw new Error(`${configPath} lists no "mutate" patterns`)
  }
  return mutate
}

/** One pattern matches it and no `!` pattern does. */
export function isMutated(file: string, patterns: readonly string[]): boolean {
  const matches = (pattern: string): boolean => matchesGlob(file, pattern)
  const included = patterns.filter((pattern) => !pattern.startsWith(NEGATION)).some(matches)
  const excluded = patterns
    .filter((pattern) => pattern.startsWith(NEGATION))
    .some((pattern) => matches(pattern.slice(NEGATION.length)))
  return included && !excluded
}

/** The first failed run's exit code, else success. */
export function exitCodeOfTheRound(exitCodes: readonly number[]): number {
  return exitCodes.find((exitCode) => exitCode !== STRYKER_SUCCEEDED) ?? STRYKER_SUCCEEDED
}
