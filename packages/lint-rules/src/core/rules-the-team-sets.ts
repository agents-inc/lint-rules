import { type Catalog, routeOf } from '@workspace/rule-data'
import { twinsOf } from './catalog-lookups.ts'
import { layersKeepingRules, type RuleLayers } from './resolve-rule-layers.ts'

// A rule the team's ESLint or oxlint config sets anywhere is the team's in every file. Both merges close the
// set here, so both drop the same rules.

/** A core rule and its typescript-eslint extension count as one rule. */
export function rulesTheTeamSets(setInEitherConfig: readonly string[], catalog: Catalog): ReadonlySet<string> {
  return withEveryTwin(new Set(setInEitherConfig), catalog)
}

export function withEveryTwin(ruleIds: ReadonlySet<string>, catalog: Catalog): ReadonlySet<string> {
  const widened = new Set([...ruleIds, ...twinsOfEach(ruleIds, catalog)])
  return widened.size === ruleIds.size ? ruleIds : withEveryTwin(widened, catalog)
}

function twinsOfEach(ruleIds: ReadonlySet<string>, catalog: Catalog): string[] {
  return [...ruleIds].flatMap((ruleId) => twinsOf(routeOf(ruleId, catalog), catalog))
}

export function ourLayersLeavingOut(setByTheTeam: ReadonlySet<string>, layers: RuleLayers): RuleLayers {
  const kept = layersKeepingRules(layers, ({ id }) => !setByTheTeam.has(id))
  return { ...kept, statedInRules: kept.statedInRules.filter((ruleId) => !setByTheTeam.has(ruleId)) }
}
