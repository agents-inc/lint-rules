import type { Catalog, OxlintRule } from '@workspace/rule-data'
import type { OxlintConfig } from 'oxlint'
import type { EditorParts } from '../core/editor-parts.ts'
import { type RuleLayers, ruleSettingsOfEveryLayer } from '../core/resolve-rule-layers.ts'
import { oxlintPartOf } from './agent-configs.ts'
import type { OxlintFinding } from './engine-clis.ts'
import { eslintNamesOf, typescriptEslintTwinsOf } from './other-eslint-names.ts'
import { oxlintCodeOfRule } from './oxlint-codes.ts'
import { isIgnoredByOxlintConfig, oxlintSeverityFor } from './oxlint-config-oracle.ts'
import { oxlintPartAlone } from './oxlint-part-alone.ts'
import { ruleIdsTheTeamsOxlintConfigSets } from './oxlint-rules-the-team-sets.ts'

/** Whose findings of a code the merged oxlint config owes in a file: the team config alone's, our oxlint part alone's, or none. */
export type FindingOwner = 'the team' | 'ours' | 'nobody'

/** The owner of the findings of a code in a file, by the file's path relative to the config. */
export type OwnerOfFindings = (file: string, code: string) => FindingOwner

/** The findings of the team's config alone, and of our oxlint part alone, over the same files. */
export type FindingsAlone = { readonly teamAlone: readonly OxlintFinding[]; readonly oursAlone: readonly OxlintFinding[] }

/** The team's two configs, as the merge reads them: its oxlint config, and the rule keys its ESLint config states anywhere. */
export type TeamConfigsRead = { readonly oxlint: OxlintConfig; readonly eslintRuleKeys: readonly string[] }

const RUNNING_SEVERITIES: ReadonlySet<string | undefined> = new Set(['warn', 'error'])
const OFF = 'off'

/**
 * The owner of each code's findings, rule by rule (decisions.md, "Owner 2026-10-14";
 * spec-merge-model.md, 1.1):
 * - the team's in every file for a rule the team sets anywhere, in its oxlint config (a statement
 *   oxlint counts, a category it turns on, a key under a JS plugin's prefix) or its ESLint config, a
 *   core rule and typescript-eslint's twin of it counting as one rule;
 * - ours where our oxlint part alone runs any other rule in the file;
 * - nobody's elsewhere for a rule our ESLint part runs anywhere, under either twin's name: the team's
 *   config alone can report it only by oxlint's silent `correctness: warn`, which sets no rule, and
 *   the merge switches that copy off wherever it would run (decisions.md, "Owner 2026-10-14
 *   (questions on the merge rework spec", point 1);
 * - the team's elsewhere, where neither reports it, and for a code no rule of oxlint's has, a JS
 *   plugin's.
 */
export function ownerOfOxlintFindings(parts: EditorParts, team: TeamConfigsRead, catalog: Catalog): OwnerOfFindings {
  const ourPartAlone = oxlintPartAlone(oxlintPartOf(parts), catalog)
  const ruleByCode = new Map(catalog.oxlintRules.map((rule): [string, OxlintRule] => [oxlintCodeOfRule(rule), rule]))
  const namesTheTeamSets = eslintNamesSetBy(team, catalog)
  const ourEslintPartRuns = ruleIdsTurnedOnIn(parts.eslint.layers)
  return (file, code) => {
    const rule = ruleByCode.get(code)
    if (rule === undefined || isSetByTheTeam(rule.id, namesTheTeamSets, catalog)) return 'the team'
    if (runsIn(ourPartAlone, file, rule)) return 'ours'
    return [rule.id, ...typescriptEslintTwinsOf(rule.id)].some((id) => ourEslintPartRuns.has(id)) ? 'nobody' : 'the team'
  }
}

/** Every rule a layer turns on, at the top level or in an entry, on TS files alone included. */
function ruleIdsTurnedOnIn(layers: RuleLayers): ReadonlySet<string> {
  return new Set(
    ruleSettingsOfEveryLayer(layers).flatMap((settings) => Object.entries(settings).flatMap(([id, { severity }]) => (severity === OFF ? [] : [id]))),
  )
}

/** The findings the merged config owes: the team's alone where they are the team's, ours alone where they are ours, and none where they are nobody's. */
export function oxlintFindingsOwed({ teamAlone, oursAlone }: FindingsAlone, ownerOf: OwnerOfFindings): OxlintFinding[] {
  return [...teamAlone.filter((finding) => ownerOf(finding.file, finding.rule) === 'the team'), ...oursAlone.filter((finding) => ownerOf(finding.file, finding.rule) === 'ours')]
}

/** Every ESLint name of each rule the team's configs set, and of each twin of it: the ESLint config's keys as written. */
function eslintNamesSetBy({ oxlint, eslintRuleKeys }: TeamConfigsRead, catalog: Catalog): ReadonlySet<string> {
  const setInOxlint = ruleIdsTheTeamsOxlintConfigSets(oxlint, catalog).flatMap((id) => eslintNamesOf(id, catalog))
  const keys = [...setInOxlint, ...eslintRuleKeys]
  return new Set([...keys, ...keys.flatMap(typescriptEslintTwinsOf)])
}

/** The team sets the rule where it sets any ESLint name of it or of a twin of it. */
function isSetByTheTeam(ruleId: string, namesTheTeamSets: ReadonlySet<string>, catalog: Catalog): boolean {
  return [ruleId, ...typescriptEslintTwinsOf(ruleId)].flatMap((id) => eslintNamesOfARuleOfOurs(id, catalog)).some((name) => namesTheTeamSets.has(name))
}

/** Every ESLint name of a rule the catalog routes; a twin it does not route goes by its ID alone. */
function eslintNamesOfARuleOfOurs(ruleId: string, catalog: Catalog): string[] {
  return catalog.rules.has(ruleId) ? eslintNamesOf(ruleId, catalog) : [ruleId]
}

/** Whether the config runs the rule in the file: not ignored there, and on there. */
function runsIn(config: OxlintConfig, file: string, { oxlintName }: OxlintRule): boolean {
  return !isIgnoredByOxlintConfig(config, file) && RUNNING_SEVERITIES.has(oxlintSeverityFor(config, file, oxlintName))
}
