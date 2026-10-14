import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import type { ESLint, Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import type { TwoSetLintRulesInput } from '../../core/lint-rules-input.ts'
import type { RuleInPlay, RulesInPlay, SidesOfAFile } from '../eslint-entries-owed.ts'
import { buildFakePlugin } from './catalog-factories.ts'
import { buildTwoSetLintRules } from './lint-rules-factories.ts'
import { buildTeamEslintBlock, buildTeamEslintBlockTurningOn } from './team-config-factories.ts'

/** A team's whole ESLint config: whatever ESLint's defineConfig takes. */
type TeamEslintConfig = Parameters<typeof defineConfig>[number]

/**
 * One of our rules, the name a team's block states it by, the plugins the block registers to do
 * so, the options a full entry of the team's gives (valid for the module that name runs), and the
 * prefixes the team registers our plugins under, keyed by our prefix.
 */
export type TeamsNameOfOurRule = {
  readonly ours: string
  readonly teams: string
  readonly plugins: Readonly<Record<string, ESLint.Plugin>>
  readonly options: readonly unknown[]
  readonly teamsPrefixes: ReadonlyMap<string, readonly string[]>
}

/** An entry of ours stating the shape's rule at the severity given, in the files given. */
export type OurEntryOfTheRule = { readonly files: readonly string[]; readonly severity: string }

/** What a value adds to the team's one block. */
export type TeamBlockPiece = {
  readonly stating?: TeamsNameOfOurRule
  readonly scope?: TeamBlockScope
  /** The team's entry, given the options a full entry gives. */
  readonly entryOf?: (options: readonly unknown[]) => Linter.RuleEntry
}

/** What a value adds to how our settings state the shape's rule. */
export type OurSettingsPiece = {
  readonly topLevel?: string
  readonly entry?: OurEntryOfTheRule
  readonly ignores?: readonly string[]
}

/** One value of a dimension the ESLint merge's shapes vary along: what it adds to the team's block, and to our settings. */
export type EslintMergeShapeValue = { readonly name: string; readonly team: TeamBlockPiece; readonly ours: OurSettingsPiece }

/** A shape built: the rule and the name the team states it by, the team's config, and our settings. */
export type EslintMergeShape = {
  readonly stating: TeamsNameOfOurRule
  readonly teamConfig: Linter.Config[]
  readonly lintRules: TwoSetLintRulesInput
}

// The files our base block lints; a team block naming no files applies to every one of them.
const EVERY_JS_AND_TS_FILE = '**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'

/** Where a team block applies: the files and ignores ESLint reads it with, from its basePath when it has one. */
export type TeamBlockScope = Pick<Linter.Config, 'files' | 'ignores' | 'basePath'>

/** A plugin's own name and version, as it gives them. */
export type PluginIdentity = { readonly name: string; readonly version: string }

/** A team block turning on every rule ID given, at error, as buildTeamEslintBlockTurningOn does, within the scope given. */
export function buildTeamEslintBlockTurningOnWithin(name: string, ruleIds: readonly string[], scope: TeamBlockScope): Linter.Config {
  return { ...buildTeamEslintBlockTurningOn(name, ruleIds), ...scope }
}

/**
 * A plugin of rules that report nothing, giving its name and version at its top level, which ESLint
 * reads before its meta, as a plugin written before `meta` existed does.
 */
export function buildPluginNamedAtTopLevel(ruleNames: readonly string[], { name, version }: PluginIdentity): ESLint.Plugin {
  return { ...buildFakePlugin(ruleNames), name, version }
}

/** A rule the ESLint differential's oracle reads, going by the names given (its own ID among them) and twinned with the rules given. */
export function buildRuleInPlay(rule: string, { names = [rule], twins = [] }: Partial<Omit<RuleInPlay, 'rule'>> = {}): RuleInPlay {
  return { rule, names, twins }
}

/** The rules the oracle reads, which the team sets nowhere unless given. */
export function buildRulesInPlay(rules: readonly RuleInPlay[], { setByTheTeam = false }: Partial<Pick<RulesInPlay, 'setByTheTeam'>> = {}): RulesInPlay {
  return { rules, setByTheTeam }
}

/** One file as the oracle reads it: no entry on either side unless given. */
export function buildSidesOfAFile({ team = {}, ours = {} }: Partial<SidesOfAFile> = {}): SidesOfAFile {
  return { team, ours }
}

/** The plugin installed under the prefix, as a team imports it: the very object the registry holds where ours is that install. */
export function installedEslintPlugin(prefix: string): ESLint.Plugin {
  const plugin = eslintPlugins[prefix]
  if (plugin === undefined) throw new Error(`no ESLint plugin is installed under ${prefix}`)
  return plugin
}

/**
 * The team's config as ESLint reads it alone, made to lint every JS and TS file, as merged beside
 * our base block it does: a team block naming no files then applies to each of them. The first block
 * names files and nothing else, so it sets nothing.
 */
export function buildTeamConfigAloneLintingEveryJsAndTsFile(teamConfig: TeamEslintConfig): Linter.Config[] {
  return [{ name: 'lints every JS and TS file', files: [EVERY_JS_AND_TS_FILE] }, ...defineConfig(teamConfig)]
}

/** A value adding to the team's block, to our settings, or to both. */
export function buildEslintMergeShapeValue(name: string, { team = {}, ours = {} }: Partial<Omit<EslintMergeShapeValue, 'name'>>): EslintMergeShapeValue {
  return { name, team, ours }
}

/**
 * The shape's values joined, a later value's key replacing an earlier one's: the team's one block,
 * stating the rule by its name with the entry given, where the scope given says; and our settings,
 * listing no ruleset, stating the rule as the values say. Every shape gives the name the team states,
 * the scope and the entry.
 */
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
