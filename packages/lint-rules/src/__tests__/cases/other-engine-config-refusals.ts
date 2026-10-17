import { buildTeamOxlintrcExtending } from '../factories/shape-factories.ts'
import { buildTeamBlockHoldingEslintrcEnv, buildTeamEslintBlock, buildTeamOxlintConfig } from '../factories/team-config-factories.ts'
import { jsonFileText, moduleExportingByDefaultText } from '../factories/team-config-file-factories.ts'
import { moduleThrowingAStringText, moduleThrowingCodedErrorText } from '../factories/failing-config-module-factories.ts'
import { buildTsconfigExtending } from '../factories/tsconfig-factories.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from '../team-configs-of-the-other-engine.ts'
import { type ConfigFile, NO_DEBUGGER } from './other-engine-configs.ts'

// Third arguments merge-other-engine-config.refusals.test.ts gives each merge, beside other-engine-configs.ts.

/** A value given in place of a path, and how the error refusing it describes it. */
export type ValueGiven = { readonly what: string; readonly value: unknown; readonly described: string }

/** A file named as the team's other config, and how the error refusing it describes what it holds. */
export type FileHoldingNoConfig = ConfigFile & { readonly what: string; readonly described: string }

/** A config module that fails as it loads, and the reason the error refusing it gives. */
export type FailingConfigModule = ConfigFile & { readonly what: string; readonly reason: string }

const PATH_OF_A_CONFIG = 'oxlint.config.mts'
const CODED_ERROR_MESSAGE = 'the team config could not reach its database'
const CODE_OF_ANOTHER_FAILURE = 'ERR_TEAM_CONFIG_OFFLINE'
const THROWN_STRING = 'the team config gave up'

export const VALUES_THAT_ARE_NO_PATH: readonly ValueGiven[] = [
  { what: 'an array of paths', value: [PATH_OF_A_CONFIG], described: 'an array' },
  { what: 'an object naming a path', value: { path: PATH_OF_A_CONFIG }, described: 'an object' },
  { what: 'a boolean', value: true, described: 'boolean true' },
]

export const JSON_FILES_HOLDING_NO_OBJECT: readonly FileHoldingNoConfig[] = [
  { what: 'an array of configs', file: 'array.oxlintrc.json', text: jsonFileText([EMPTY_TEAM_OXLINT_CONFIG]), described: 'an array' },
  { what: 'null', file: 'null.oxlintrc.json', text: jsonFileText(null), described: 'null' },
  { what: 'a string', file: 'string.oxlintrc.json', text: jsonFileText(PATH_OF_A_CONFIG), described: `string ${PATH_OF_A_CONFIG}` },
]

export const JSON_FILE_HOLDING_AN_OBJECT: ConfigFile = { file: 'object.oxlintrc.json', text: jsonFileText(EMPTY_TEAM_OXLINT_CONFIG) }

export const MODULES_EXPORTING_NO_OBJECT: readonly FileHoldingNoConfig[] = [
  { what: 'null', file: 'null.oxlint.config.mts', text: moduleExportingByDefaultText(null), described: 'null' },
  { what: 'an array of configs', file: 'array.oxlint.config.mts', text: moduleExportingByDefaultText([buildTeamOxlintConfig()]), described: 'an array' },
]

export const MODULE_EXPORTING_AN_OBJECT: ConfigFile = { file: 'object.oxlint.config.mts', text: moduleExportingByDefaultText(buildTeamOxlintConfig()) }

/** Other than by awaiting at their top level: one throwing an error with its own code, as Node's do, and one throwing a string. */
export const MODULES_FAILING_AS_THEY_LOAD: readonly FailingConfigModule[] = [
  {
    what: 'throws an error carrying a code of its own',
    file: 'coded-error.config.mts',
    text: moduleThrowingCodedErrorText(CODED_ERROR_MESSAGE, CODE_OF_ANOTHER_FAILURE),
    reason: CODED_ERROR_MESSAGE,
  },
  { what: 'throws a string', file: 'string-thrown.config.mts', text: moduleThrowingAStringText(THROWN_STRING), reason: THROWN_STRING },
]

// ESLint's defineConfig reads a block nested in arrays at any depth (measured, ESLint 10.12): three
// arrays deep inside the exported array, it lies past a read of up to three levels.
const NESTED_BLOCK_DEPTH = 3

function nestedInArrays(value: unknown, depth: number): unknown {
  return depth === 0 ? value : nestedInArrays([value], depth - 1)
}

/** Its block nested three arrays deep holds eslintrc's `env`. */
export const ESLINT_CONFIG_NESTING_ENV: ConfigFile = {
  file: 'nesting-env.eslint.config.mjs',
  text: moduleExportingByDefaultText([
    buildTeamEslintBlock('team/ts', { files: ['**/*.ts'] }),
    nestedInArrays(buildTeamBlockHoldingEslintrcEnv('team/node', { node: true }), NESTED_BLOCK_DEPTH),
  ]),
}

export const ESLINT_CONFIG_NESTING_NO_DEBUGGER_OFF: ConfigFile = {
  file: 'nesting-no-debugger-off.eslint.config.mjs',
  text: moduleExportingByDefaultText([
    buildTeamEslintBlock('team/ts', { files: ['**/*.ts'] }),
    nestedInArrays(buildTeamEslintBlock('team/debugging', { rules: { [NO_DEBUGGER]: 'off' } }), NESTED_BLOCK_DEPTH),
  ]),
}

const PACKAGE_TSCONFIG: ConfigFile = {
  file: 'tsconfig.json',
  text: jsonFileText(buildTsconfigExtending('@workspace/typescript-config/node.json', { include: ['src'], exclude: ['dist'] })),
}

export const OXLINTRC_EXTENDING_A_TSCONFIG: ConfigFile = {
  file: 'extending-a-tsconfig.oxlintrc.json',
  text: jsonFileText(buildTeamOxlintrcExtending([`./${PACKAGE_TSCONFIG.file}`], EMPTY_TEAM_OXLINT_CONFIG)),
}

export const KEYS_OF_THE_EXTENDED_TSCONFIG_NO_OXLINT_CONFIG_HOLDS = 'include, exclude'

export const OXLINTRC_EXTENDING_A_TSCONFIG_FILES: readonly ConfigFile[] = [OXLINTRC_EXTENDING_A_TSCONFIG, PACKAGE_TSCONFIG]
