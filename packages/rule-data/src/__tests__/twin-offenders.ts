import type { Catalog, RuleRoute } from '../catalog.ts'
import { sharedKeys } from '../collections.ts'

/** A shipped rule and one of its typescript-eslint twins. */
type ShippedTwin = { readonly ruleId: string; readonly twin: string }

/**
 * `core rule: extension, extension` for each core rule more than one installed rule extends, in the
 * map's order. The ESLint merge gives a team its twin back where an entry of ours turns our rule
 * off; with two extensions of one core rule, the other may still run there.
 */
export function coreRulesExtendedMoreThanOnce(coreRuleExtensions: Catalog['coreRuleExtensions']): string[] {
  return [...coreRuleExtensions]
    .filter(([, extensions]) => extensions.length > 1)
    .map(([coreRule, extensions]) => `${coreRule}: ${extensions.join(', ')}`)
}

/**
 * `twin: rule, rule` for each rule that is a typescript-eslint twin of more than one shipped rule,
 * in route order: of a core rule, each rule extending it; of an extension, the core rule it extends.
 * A core rule and its extension both shipped are each other's twin, and share none.
 */
export function twinsSharedByShippedRules(routes: Iterable<RuleRoute>, coreRuleExtensions: Catalog['coreRuleExtensions']): string[] {
  const shippedTwins = [...routes]
    .filter(({ shipped }) => shipped !== null)
    .flatMap(({ id }) => twinsOf(id, coreRuleExtensions).map((twin): ShippedTwin => ({ ruleId: id, twin })))
  return sharedKeys(shippedTwins, ({ twin }) => twin).map(([twin, sharing]) => `${twin}: ${sharing.map(({ ruleId }) => ruleId).join(', ')}`)
}

function twinsOf(ruleId: string, coreRuleExtensions: Catalog['coreRuleExtensions']): string[] {
  return [...coreRuleExtensions].flatMap(([coreRule, extensions]) => {
    if (coreRule === ruleId) return [...extensions]
    return extensions.includes(ruleId) ? coreRule : []
  })
}
