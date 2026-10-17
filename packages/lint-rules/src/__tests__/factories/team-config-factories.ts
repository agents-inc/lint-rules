import type { ESLint, Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import tseslint from 'typescript-eslint'
import { ruleNamesByPrefix } from '../../core/build-eslint-config.ts'
import type { mergeEslintConfig } from '../../eslint.ts'
import { buildReportingPlugin } from './catalog-factories.ts'

type TeamEslintConfig = Parameters<typeof mergeEslintConfig>[0]

export type TeamTypeInformation = 'projectService' | 'project'

const PARSER_OPTIONS_GIVING_TYPES: Readonly<Record<TeamTypeInformation, Linter.ParserOptions>> = {
  projectService: { projectService: true },
  project: { project: './tsconfig.json' },
}

/** Named so a spec can tell it from ours. */
export function buildTeamEslintBlock(name: string, fields: Omit<Linter.Config, 'name'> = {}): Linter.Config {
  return { name, ...fields }
}

export function buildTeamEslintConfigExtending(name: string, extended: readonly Linter.Config[]): TeamEslintConfig {
  return { name, extends: [...extended] }
}

/** Registers under each plugin prefix a plugin whose rules of those names report every file, so a spec sees them fire. */
export function buildTeamEslintBlockTurningOn(name: string, ruleIds: readonly string[]): Linter.Config {
  return buildTeamEslintBlockSetting(name, Object.fromEntries(ruleIds.map((id): [string, Linter.RuleEntry] => [id, 'error'])))
}

/** As `buildTeamEslintBlockTurningOn`, with the entries given; the stand-in rules take any options. */
export function buildTeamEslintBlockSetting(name: string, rules: Readonly<Linter.RulesRecord>): Linter.Config {
  const plugins = [...ruleNamesByPrefix(Object.keys(rules))].map(([prefix, ruleNames]): [string, ESLint.Plugin] => [
    prefix,
    buildReportingPlugin(ruleNames),
  ])
  return buildTeamEslintBlock(name, { plugins: Object.fromEntries(plugins), rules: { ...rules } })
}

export function buildTeamTypedEslintBlock(
  name: string,
  typeInformation: TeamTypeInformation,
  fields: Omit<Linter.Config, 'name' | 'languageOptions'> = {},
): Linter.Config {
  return buildTeamEslintBlock(name, { ...fields, languageOptions: { parserOptions: PARSER_OPTIONS_GIVING_TYPES[typeInformation] } })
}

/** For a block switching type information off again (`projectService: false`) or leaving it on (`program: null`). */
export function buildTeamEslintBlockSettingParserOptions(
  name: string,
  parserOptions: Linter.ParserOptions,
  fields: Omit<Linter.Config, 'name' | 'languageOptions'> = {},
): Linter.Config {
  return buildTeamEslintBlock(name, { ...fields, languageOptions: { parserOptions } })
}

/** typescript-eslint's disableTypeChecked, as a team spreads it into a block of its own. */
export function buildTeamDisableTypeCheckedBlock(name: string, fields: Omit<Linter.Config, 'name' | 'languageOptions' | 'rules'> = {}): Linter.Config {
  return { ...tseslint.configs.disableTypeChecked, name, ...fields }
}

/** disableTypeChecked's language options alone, setting no rule. */
export function buildTeamBlockSwitchingTypesOffAsDisableTypeCheckedDoes(name: string, fields: Omit<Linter.Config, 'name' | 'languageOptions' | 'rules'> = {}): Linter.Config {
  return { ...tseslint.configs.disableTypeChecked, name, ...fields, rules: {} }
}

/** Refuses to parse: specs read which parser ESLint calculates for a file, and lint none with it. */
export function buildTeamParser(name: string): Linter.Parser {
  return {
    meta: { name },
    parseForESLint: () => {
      throw new Error(`the team's parser ${name} parses nothing in these specs`)
    },
  }
}

/** Every key a flat config block can hold (measured, ESLint 10.12), each a value no merge reads but the rule it turns off. */
export function buildTeamEslintBlockHoldingEveryKey(name: string, ruleTurnedOff: string): Linter.Config {
  return {
    name,
    basePath: '.',
    files: ['**/*.ts'],
    ignores: ['dist/**'],
    language: 'js/js',
    languageOptions: { ecmaVersion: 'latest' },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    processor: { meta: { name: 'team-processor' } },
    plugins: {},
    rules: { [ruleTurnedOff]: 'off' },
    settings: {},
  }
}

/** No flat config block holds eslintrc's `env`, as a half-migrated config still does. */
export function buildTeamBlockHoldingEslintrcEnv(name: string, env: Readonly<Record<string, boolean>>): Linter.Config & { readonly env: Readonly<Record<string, boolean>> } {
  return { ...buildTeamEslintBlock(name), env }
}

export function buildTeamOxlintConfig(fields: OxlintConfig = {}): OxlintConfig {
  return { ...fields }
}

/** Every key oxlint's `OxlintConfig` type gives (measured, oxlint 1.87), each a value no merge reads but the rule it turns off. */
export function buildTeamOxlintConfigHoldingEveryKey(ruleTurnedOff: string): OxlintConfig {
  return {
    categories: { correctness: 'off' },
    env: { browser: true },
    extends: [],
    globals: { team: 'readonly' },
    ignorePatterns: ['dist/**'],
    jsPlugins: [],
    options: { typeAware: false },
    overrides: [],
    plugins: ['typescript'],
    rules: { [ruleTurnedOff]: 'off' },
    settings: {},
  }
}

/** As .oxlintrc.json writes it: `$schema` too, which oxlint takes in a JS or TS config though its type leaves it out (measured, 1.87). */
export function buildTeamOxlintrcHoldingEveryKey(ruleTurnedOff: string): OxlintConfig & { readonly $schema: string } {
  return { $schema: './node_modules/oxlint/configuration_schema.json', ...buildTeamOxlintConfigHoldingEveryKey(ruleTurnedOff) }
}

/** Pieces in order: a later key replaces an earlier one's, but `extends`, `overrides` and `rules` join. */
export function buildTeamOxlintConfigFrom(pieces: readonly OxlintConfig[]): OxlintConfig {
  const joined = pieces.reduce<OxlintConfig>((config, piece) => ({ ...config, ...piece }), {})
  const extended = pieces.flatMap(({ extends: extendedConfigs = [] }) => extendedConfigs)
  const overrides = pieces.flatMap(({ overrides: pieceOverrides = [] }) => pieceOverrides)
  const statements = pieces.flatMap(({ rules }) => (rules === undefined ? [] : Object.entries(rules)))
  return {
    ...joined,
    ...(extended.length === 0 ? {} : { extends: extended }),
    ...(overrides.length === 0 ? {} : { overrides }),
    ...(statements.length === 0 ? {} : { rules: Object.fromEntries(statements) }),
  }
}
