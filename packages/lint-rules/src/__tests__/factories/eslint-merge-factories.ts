import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import type { ESLint, Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import type { TwoSetLintRulesInput } from '../../core/lint-rules-input.ts'
import type { RuleInPlay, RulesInPlay, SidesOfAFile } from '../eslint-entries-owed.ts'
import { buildFakePlugin } from './catalog-factories.ts'
import { buildTwoSetLintRules } from './lint-rules-factories.ts'
import { buildTeamEslintBlock, buildTeamEslintBlockTurningOn } from './team-config-factories.ts'

type TeamEslintConfig = Parameters<typeof defineConfig>[number]

/** `teamsPrefixes` is keyed by our prefix; the options are valid for the module the team's name runs. */
export type TeamsNameOfOurRule = {
  readonly ours: string
  readonly teams: string
  readonly plugins: Readonly<Record<string, ESLint.Plugin>>
  readonly options: readonly unknown[]
  readonly teamsPrefixes: ReadonlyMap<string, readonly string[]>
}

export type OurEntryOfTheRule = { readonly files: readonly string[]; readonly severity: string }

export type TeamBlockPiece = {
  readonly stating?: TeamsNameOfOurRule
  readonly scope?: TeamBlockScope
  readonly entryOf?: (options: readonly unknown[]) => Linter.RuleEntry
}

export type OurSettingsPiece = {
  readonly topLevel?: string
  readonly entry?: OurEntryOfTheRule
  readonly ignores?: readonly string[]
}

/** One value of a dimension the ESLint merge's shapes vary along. */
export type EslintMergeShapeValue = { readonly name: string; readonly team: TeamBlockPiece; readonly ours: OurSettingsPiece }

export type EslintMergeShape = {
  readonly stating: TeamsNameOfOurRule
  readonly teamConfig: Linter.Config[]
  readonly lintRules: TwoSetLintRulesInput
}

// The files our base block lints; a team block naming no files applies to every one of them.
const EVERY_JS_AND_TS_FILE = '**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'

/** Where a team block applies: the files and ignores ESLint reads it with, from its basePath when it has one. */
export type TeamBlockScope = Pick<Linter.Config, 'files' | 'ignores' | 'basePath'>

export type PluginIdentity = { readonly name: string; readonly version: string }

/** As buildTeamEslintBlockTurningOn, within the scope given. */
export function buildTeamEslintBlockTurningOnWithin(name: string, ruleIds: readonly string[], scope: TeamBlockScope): Linter.Config {
  return { ...buildTeamEslintBlockTurningOn(name, ruleIds), ...scope }
}

/** Name and version at its top level, which ESLint reads before `meta`, as a plugin older than `meta` gives them. */
export function buildPluginNamedAtTopLevel(ruleNames: readonly string[], { name, version }: PluginIdentity): ESLint.Plugin {
  return { ...buildFakePlugin(ruleNames), name, version }
}

export function buildRuleInPlay(rule: string, { names = [rule], twins = [] }: Partial<Omit<RuleInPlay, 'rule'>> = {}): RuleInPlay {
  return { rule, names, twins }
}

export function buildRulesInPlay(rules: readonly RuleInPlay[], { setByTheTeam = false }: Partial<Pick<RulesInPlay, 'setByTheTeam'>> = {}): RulesInPlay {
  return { rules, setByTheTeam }
}

export function buildSidesOfAFile({ team = {}, ours = {} }: Partial<SidesOfAFile> = {}): SidesOfAFile {
  return { team, ours }
}

/** The very object the registry holds where ours is that install. */
export function installedEslintPlugin(prefix: string): ESLint.Plugin {
  const plugin = eslintPlugins[prefix]
  if (plugin === undefined) throw new Error(`no ESLint plugin is installed under ${prefix}`)
  return plugin
}

/** Made to lint every JS and TS file, as it does merged beside our base block; the first block names files only. */
export function buildTeamConfigAloneLintingEveryJsAndTsFile(teamConfig: TeamEslintConfig): Linter.Config[] {
  return [{ name: 'lints every JS and TS file', files: [EVERY_JS_AND_TS_FILE] }, ...defineConfig(teamConfig)]
}

export function buildEslintMergeShapeValue(name: string, { team = {}, ours = {} }: Partial<Omit<EslintMergeShapeValue, 'name'>>): EslintMergeShapeValue {
  return { name, team, ours }
}

/** A later value's key replaces an earlier one's. Every shape gives the team's name for the rule, the scope and the entry. */
export function buildEslintMergeShape(tsconfigRootDir: string, values: readonly EslintMergeShapeValue[]): EslintMergeShape {
  const team = values.reduce<TeamBlockPiece>((joined, value) => ({ ...joined, ...value.team }), {})
  const ours = values.reduce<OurSettingsPiece>((joined, value) => ({ ...joined, ...value.ours }), {})
  const { stating, scope, entryOf } = team
  if (stating === undefined || scope === undefined || entryOf === undefined) {
    throw new Error("a shape gives the name the team states, where the team's block applies, and its entry")
  }
  const teamBlock = buildTeamEslintBlock('team', { ...scope, plugins: { ...stating.plugins }, rules: { [stating.teams]: entryOf(stating.options) } })
  return { stating, teamConfig: [teamBlock], lintRules: buildTwoSetLintRules({}, { tsconfigRootDir, ...ourSettingsOf(stating.ours, ours) }) }
}

function ourSettingsOf(ruleId: string, { topLevel, entry, ignores }: OurSettingsPiece): Partial<TwoSetLintRulesInput> {
  return {
    ...(topLevel === undefined ? {} : { rules: { [ruleId]: topLevel } }),
    ...(entry === undefined ? {} : { fileOverrides: [{ files: entry.files, rules: { [ruleId]: entry.severity } }] }),
    ...(ignores === undefined ? {} : { ignores }),
  }
}
