import { type Catalog, routeOf } from '@workspace/rule-data'
import { twinsOf } from './catalog-lookups.ts'
import { layersKeepingRules, type RuleLayers } from './resolve-rule-layers.ts'

// The owner's model (decisions.md, "Owner 2026-10-14"; spec-merge-model.md, 1.1): a rule the team's
// ESLint or oxlint config sets anywhere is the team's in every file, and our editor part states no
// name of it in either engine. Both merges take the rules set in each config from the same readers
// and close them here, so both drop the same rules.

/**
 * Every rule either of the team's configs sets, with every twin of each (a core rule and
 * typescript-eslint's extension of it count as one rule), and every twin of those, until none is left out.
 */
export function rulesTheTeamSets(setInEitherConfig: readonly string[], catalog: Catalog): ReadonlySet<string> {
  return withEveryTwin(new Set(setInEitherConfig), catalog)
}

/** The rules, with every twin of each, and every twin of those, until none is left out. */
export function withEveryTwin(ruleIds: ReadonlySet<string>, catalog: Catalog): ReadonlySet<string> {
  const widened = new Set([...ruleIds, ...twinsOfEach(ruleIds, catalog)])
  return widened.size === ruleIds.size ? ruleIds : withEveryTwin(widened, catalog)
}

/** typescript-eslint's twins of each of the rules. */
function twinsOfEach(ruleIds: ReadonlySet<string>, catalog: Catalog): string[] {
  return [...ruleIds].flatMap((ruleId) => twinsOf(routeOf(ruleId, catalog), catalog))
}

/**
 * Our layers stating none of the team's rules, at any severity, in any layer: nor naming one among
 * the rules the consumer's top-level `rules` state, which decide a twin pair a layer names (D9).
 */
export function ourLayersLeavingOut(setByTheTeam: ReadonlySet<string>, layers: RuleLayers): RuleLayers {
  const kept = layersKeepingRules(layers, ({ id }) => !setByTheTeam.has(id))
  return { ...kept, statedInRules: kept.statedInRules.filter((ruleId) => !setByTheTeam.has(ruleId)) }
}
