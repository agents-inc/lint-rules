import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { strykerOptionsWithMutate, strykerOptionsWithoutMutate } from './__tests__/factories/stryker-options-factories.ts'
import {
  configsOfTheRound,
  exitCodeOfTheRound,
  isMutated,
  mutatePatternsIn,
  mutatePatternsOf,
  PACKAGE_STRYKER_CONFIGS,
  type StrykerOptions,
} from './stryker-round.ts'

// scripts/mutate-changed-lines.mts runs each package's Stryker config on the lines changed in that
// package, or the one config named first.

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const LINT_RULES_CONFIG = 'stryker.config.json'
const RULE_DATA_CONFIG = 'stryker.rule-data.config.mjs'
const HOUSE_CONFIG = 'stryker.eslint-plugin-house.config.mjs'
const SECOND_PASS_CONFIG = 'stryker.static.config.mjs'
const CONFIG_NO_ROUND_READS = 'stryker.config.cjs'

const LINT_RULES_SOURCE = 'packages/lint-rules/src/core/editor-parts.ts'
const LINT_RULES_TEST = 'packages/lint-rules/src/core/twin-pairs.test.ts'
const LINT_RULES_TEST_HELPER = 'packages/lint-rules/src/__tests__/engine-run.ts'
const RULE_DATA_SOURCE = 'packages/rule-data/src/generate/build-routing.ts'
const RULE_DATA_TEST = 'packages/rule-data/src/generate/build-routing.test.ts'
const RULE_DATA_TEST_HELPER = 'packages/rule-data/src/__tests__/twin-pair-runs.ts'
const RULE_DATA_GENERATED = 'packages/rule-data/src/generated/rule-ids.ts'
const RULE_DATA_DECLARATIONS = 'packages/rule-data/src/untyped-eslint-plugins.d.ts'
const HOUSE_SOURCE = 'packages/eslint-plugin-house/src/rules/require-class-helper.ts'
const HOUSE_TEST = 'packages/eslint-plugin-house/src/rules/require-class-helper.test.ts'
const HOUSE_TEST_CASES = 'packages/eslint-plugin-house/src/__tests__/cases/require-class-helper.ts'

const PATTERN = 'packages/rule-data/src/**/*.ts'
const OTHER_PACKAGE_PATTERN = 'packages/eslint-plugin-house/src/**/*.ts'
const NEGATED_PATTERN = '!packages/rule-data/src/**/*.test.ts'
// Read without its first character, as a `!` pattern is, it still matches FILE_AT_ONE_FOLDER.
const PATTERN_BEGINNING_WITH_A_WILDCARD = '**/*.ts'
const OTHER_PACKAGE_SOURCE = 'packages/eslint-plugin-house/src/index.ts'
const FILE_AT_ONE_FOLDER = 'src/index.ts'

const NOT_A_PATTERN = 42

const FORCE = '--force'
const STRYKER_OPTIONS = [FORCE, '--concurrency', '2']

const SUCCEEDED = 0
const FAILED = 1
const KILLED = 2

function configPath(configFile: string): string {
  return join(REPO_ROOT, configFile)
}

async function filesEachConfigMutates(configFiles: readonly string[], files: readonly string[]): Promise<Record<string, string[]>> {
  const entries = await Promise.all(
    configFiles.map(async (configFile): Promise<[string, string[]]> => {
      const patterns = await mutatePatternsOf(configPath(configFile))
      return [configFile, files.filter((file) => isMutated(file, patterns))]
    }),
  )
  return Object.fromEntries(entries)
}

describe('configsOfTheRound', () => {
  it("runs every package's config, and passes Stryker no argument, when given none", () => {
    expect(configsOfTheRound([])).toStrictEqual({ configFiles: PACKAGE_STRYKER_CONFIGS, strykerArguments: [] })
  })

  it("runs every package's config with every argument, when the first argument is an option", () => {
    expect(configsOfTheRound(STRYKER_OPTIONS)).toStrictEqual({ configFiles: PACKAGE_STRYKER_CONFIGS, strykerArguments: STRYKER_OPTIONS })
  })

  it('runs only the config named first, with the arguments after it', () => {
    expect(configsOfTheRound([SECOND_PASS_CONFIG, FORCE])).toStrictEqual({ configFiles: [SECOND_PASS_CONFIG], strykerArguments: [FORCE] })
  })
})

describe('mutatePatternsOf', () => {
  it("gives each package's source to that package's config alone, and its tests, test helpers, generated and declaration files to none", async () => {
    const files = [
      LINT_RULES_SOURCE,
      LINT_RULES_TEST,
      LINT_RULES_TEST_HELPER,
      RULE_DATA_SOURCE,
      RULE_DATA_TEST,
      RULE_DATA_TEST_HELPER,
      RULE_DATA_GENERATED,
      RULE_DATA_DECLARATIONS,
      HOUSE_SOURCE,
      HOUSE_TEST,
      HOUSE_TEST_CASES,
    ]

    expect(await filesEachConfigMutates(PACKAGE_STRYKER_CONFIGS, files)).toStrictEqual({
      [LINT_RULES_CONFIG]: [LINT_RULES_SOURCE],
      [RULE_DATA_CONFIG]: [RULE_DATA_SOURCE],
      [HOUSE_CONFIG]: [HOUSE_SOURCE],
    })
  })

  it('reads the second pass, which mutates what stryker.config.json does', async () => {
    expect(await mutatePatternsOf(configPath(SECOND_PASS_CONFIG))).toStrictEqual(await mutatePatternsOf(configPath(LINT_RULES_CONFIG)))
  })

  it('refuses, naming it, a config file that is neither .json nor .mjs', async () => {
    await expect(mutatePatternsOf(configPath(CONFIG_NO_ROUND_READS))).rejects.toThrowError(
      new Error(`${configPath(CONFIG_NO_ROUND_READS)} is no config file a round reads: give a .json or .mjs Stryker config`),
    )
  })
})

describe('mutatePatternsIn', () => {
  it('gives the patterns a config lists', () => {
    expect(mutatePatternsIn(strykerOptionsWithMutate([PATTERN, NEGATED_PATTERN]), LINT_RULES_CONFIG)).toStrictEqual([PATTERN, NEGATED_PATTERN])
  })

  it.each<{ readonly refused: string; readonly options: StrykerOptions | undefined }>([
    { refused: 'no options, as from a module with no default export', options: undefined },
    { refused: 'options with no mutate key', options: strykerOptionsWithoutMutate() },
    { refused: 'a single pattern rather than a list', options: strykerOptionsWithMutate(PATTERN) },
    { refused: 'a list holding something other than a pattern', options: strykerOptionsWithMutate([PATTERN, NOT_A_PATTERN]) },
  ])('refuses, naming the config, $refused', ({ options }) => {
    expect(() => mutatePatternsIn(options, LINT_RULES_CONFIG)).toThrowError(new Error(`${LINT_RULES_CONFIG} lists no "mutate" patterns`))
  })
})

describe('isMutated', () => {
  it('takes a file any one of several patterns matches, and leaves out a file none matches', () => {
    expect(
      [RULE_DATA_SOURCE, OTHER_PACKAGE_SOURCE, LINT_RULES_SOURCE].filter((file) => isMutated(file, [PATTERN, OTHER_PACKAGE_PATTERN])),
    ).toStrictEqual([RULE_DATA_SOURCE, OTHER_PACKAGE_SOURCE])
  })

  it('leaves out a file a ! pattern matches too, beside a file only the other pattern matches', () => {
    expect([RULE_DATA_SOURCE, RULE_DATA_TEST].filter((file) => isMutated(file, [PATTERN, NEGATED_PATTERN]))).toStrictEqual([RULE_DATA_SOURCE])
  })

  it('leaves a file out for a ! pattern alone, not for a pattern without one', () => {
    expect(
      [FILE_AT_ONE_FOLDER, RULE_DATA_TEST].filter((file) => isMutated(file, [PATTERN_BEGINNING_WITH_A_WILDCARD, NEGATED_PATTERN])),
    ).toStrictEqual([FILE_AT_ONE_FOLDER])
  })
})

describe('exitCodeOfTheRound', () => {
  it('succeeds when every run succeeded', () => {
    expect(exitCodeOfTheRound([SUCCEEDED, SUCCEEDED])).toStrictEqual(SUCCEEDED)
  })

  it('gives the exit code of the first run that failed, after one that succeeded', () => {
    expect(exitCodeOfTheRound([SUCCEEDED, KILLED, FAILED])).toStrictEqual(KILLED)
  })
})
