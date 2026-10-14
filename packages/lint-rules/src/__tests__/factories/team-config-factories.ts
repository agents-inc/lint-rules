import type { ESLint, Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import tseslint from 'typescript-eslint'
import { ruleNamesByPrefix } from '../../core/build-eslint-config.ts'
import type { mergeEslintConfig } from '../../eslint.ts'
import { buildReportingPlugin } from './catalog-factories.ts'

/** A team's whole ESLint config: whatever ESLint's defineConfig takes. */
type TeamEslintConfig = Parameters<typeof mergeEslintConfig>[0]

/** How a team gives typescript-eslint type information: its project service, or the older `project`. */
export type TeamTypeInformation = 'projectService' | 'project'

const PARSER_OPTIONS_GIVING_TYPES: Readonly<Record<TeamTypeInformation, Linter.ParserOptions>> = {
  projectService: { projectService: true },
  project: { project: './tsconfig.json' },
}

/** One block of a team's own ESLint config, named so a spec can tell it from ours. */
export function buildTeamEslintBlock(name: string, fields: Omit<Linter.Config, 'name'> = {}): Linter.Config {
  return { name, ...fields }
}

/** A team config that is one block extending others, as defineConfig's `extends` reads them. */
export function buildTeamEslintConfigExtending(name: string, extended: readonly Linter.Config[]): TeamEslintConfig {
  return { name, extends: [...extended] }
}

/**
 * A team block turning on every rule ID given, at error, and registering under each plugin prefix
 * among them a plugin whose rules of those names report every file: a team's own twins of rules,
 * whose firing a spec can see. A core rule ID needs no plugin.
 */
export function buildTeamEslintBlockTurningOn(name: string, ruleIds: readonly string[]): Linter.Config {
  return buildTeamEslintBlockSetting(name, Object.fromEntries(ruleIds.map((id): [string, Linter.RuleEntry] => [id, 'error'])))
}

/**
 * A team block giving each rule ID the entry given, options included, and registering under each
 * plugin prefix among them a plugin whose rules of those names report every file and take any
 * options. A core rule ID needs no plugin.
 */
export function buildTeamEslintBlockSetting(name: string, rules: Readonly<Linter.RulesRecord>): Linter.Config {
  const plugins = [...ruleNamesByPrefix(Object.keys(rules))].map(([prefix, ruleNames]): [string, ESLint.Plugin] => [
    prefix,
    buildReportingPlugin(ruleNames),
  ])
  return buildTeamEslintBlock(name, { plugins: Object.fromEntries(plugins), rules: { ...rules } })
}

/** A team block giving type information to the files its fields name: every file it applies to, without `files`. */
export function buildTeamTypedEslintBlock(
  name: string,
  typeInformation: TeamTypeInformation,
  fields: Omit<Linter.Config, 'name' | 'languageOptions'> = {},
): Linter.Config {
  return buildTeamEslintBlock(name, { ...fields, languageOptions: { parserOptions: PARSER_OPTIONS_GIVING_TYPES[typeInformation] } })
}

/**
 * A team block setting typescript-eslint's parser options as given, and no other language option:
 * for a block that switches type information off again (`projectService: false`) or one that leaves
 * it on (`program: null` alone).
 */
export function buildTeamEslintBlockSettingParserOptions(
  name: string,
  parserOptions: Linter.ParserOptions,
  fields: Omit<Linter.Config, 'name' | 'languageOptions'> = {},
): Linter.Config {
  return buildTeamEslintBlock(name, { ...fields, languageOptions: { parserOptions } })
}

/**
 * typescript-eslint's own disableTypeChecked config, as a team spreads it into a block of its own:
 * type information switched off, and every typed rule of typescript-eslint off, in the files its
 * fields name.
 */
export function buildTeamDisableTypeCheckedBlock(name: string, fields: Omit<Linter.Config, 'name' | 'languageOptions' | 'rules'> = {}): Linter.Config {
  return { ...tseslint.configs.disableTypeChecked, name, ...fields }
}

/**
 * The language options of typescript-eslint's disableTypeChecked alone, as a team block switching
 * type information off for the files its fields name, and setting no rule: the rules
 * disableTypeChecked turns off make each of them the team's in every file (decisions.md, "Owner
 * 2026-10-14").
 */
export function buildTeamBlockSwitchingTypesOffAsDisableTypeCheckedDoes(name: string, fields: Omit<Linter.Config, 'name' | 'languageOptions' | 'rules'> = {}): Linter.Config {
  return { ...tseslint.configs.disableTypeChecked, name, ...fields, rules: {} }
}

/**
 * A parser of the team's own, named so a spec can tell it from ours. It refuses to parse: specs read
 * which parser ESLint calculates for a file, and lint none with it.
 */
export function buildTeamParser(name: string): Linter.Parser {
  return {
    meta: { name },
    parseForESLint: () => {
      throw new Error(`the team's parser ${name} parses nothing in these specs`)
    },
  }
}

/**
 * A team block holding every key an ESLint flat config block can hold (measured, ESLint 10.12:
 * `flat-config-schema.js`, and `@eslint/config-array`'s base schema), each given a value that
 * changes nothing a merge reads but the rule it turns off.
 */
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

/** A team block still holding eslintrc's `env`, as a config half migrated to flat config does: no flat config block holds `env`. */
export function buildTeamBlockHoldingEslintrcEnv(name: string, env: Readonly<Record<string, boolean>>): Linter.Config & { readonly env: Readonly<Record<string, boolean>> } {
  return { ...buildTeamEslintBlock(name), env }
}

/** A team's own oxlint config: oxlint's defaults where a key is left out. */
export function buildTeamOxlintConfig(fields: OxlintConfig = {}): OxlintConfig {
  return { ...fields }
}

/**
 * A team oxlint config holding every key oxlint's type for a JS or TS config gives (measured,
 * oxlint 1.87: `OxlintConfig`, its schema's root keys but `$schema`), each given a value that
 * changes nothing a merge reads but the rule it turns off.
 */
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

/**
 * The same, as a team's .oxlintrc.json writes it: every key oxlint's schema lists (measured, oxlint
 * 1.87: `configuration_schema.json`, whose root takes no other key), `$schema` too, which oxlint
 * takes in a JS or TS config as well, though its type for one leaves it out (measured, oxlint 1.87).
 */
export function buildTeamOxlintrcHoldingEveryKey(ruleTurnedOff: string): OxlintConfig & { readonly $schema: string } {
  return { $schema: './node_modules/oxlint/configuration_schema.json', ...buildTeamOxlintConfigHoldingEveryKey(ruleTurnedOff) }
}

/**
 * A team's oxlint config joined from pieces, in order: a later piece's key replaces an earlier
 * one's, but `extends` and `overrides` join in the order given, and `rules` join, a later piece's
 * statement of a rule replacing an earlier one's. A key no piece sets is left out.
 */
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
