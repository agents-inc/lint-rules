import { type Catalog, routeOf, type RuleRoute } from '@workspace/rule-data'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { twinsOf } from './catalog-lookups.ts'
import { configErrorIn } from './config-error.ts'
import type { RuleSettingsInput, TwoSetLintRulesInput } from './lint-rules-input.ts'

/** A rule ID as written under one `rules` key of the config: `rules`, or an entry's `fileOverrides[i].rules`. */
type RuleNamed = { readonly key: string; readonly id: string }

type RulesWritten = Pick<TwoSetLintRulesInput, 'rules' | 'fileOverrides'>

/**
 * Checked as the config loads: the types take any rule of the catalog, and a name with no route there would otherwise
 * stop at the catalog's look-up, which names no file.
 */
// eslint-disable-next-line functional/no-return-void -- a refusal: a rule we do not ship must stop defineLintRules before it routes any rule, so it throws, and where every rule named ships it has nothing to give back
export function refuseRulesWeDoNotShip(lintRules: RulesWritten, catalog: Readonly<Catalog>): void {
  const refused = everyRuleNamedIn(lintRules).find(({ id }) => !canOurRulesName(id, catalog))
  if (refused !== undefined) throw configErrorIn(consumerConfigFiles.lintRules, refusalOf(refused))
}

function everyRuleNamedIn({ rules = {}, fileOverrides = [] }: RulesWritten): RuleNamed[] {
  return [
    ...rulesNamedUnder('rules', rules),
    ...fileOverrides.flatMap(({ rules: entryRules = {} }, index) => rulesNamedUnder(`fileOverrides[${index}].rules`, entryRules)),
  ]
}

function rulesNamedUnder(key: string, rules: RuleSettingsInput): RuleNamed[] {
  return Object.keys(rules).map((id) => ({ key, id }))
}

function canOurRulesName(id: string, catalog: Readonly<Catalog>): boolean {
  const route = catalog.rules.get(id)
  if (route === undefined) return false
  return route.shipped !== null || isTwinOfARuleWeShip(route, catalog)
}

/** Owner ruling: the other copy of a rule we ship, typescript-eslint's or the core one it extends, counts as ours. */
function isTwinOfARuleWeShip(route: Readonly<RuleRoute>, catalog: Readonly<Catalog>): boolean {
  return twinsOf(route, catalog).some((twin) => routeOf(twin, catalog).shipped !== null)
}

function refusalOf({ key, id }: RuleNamed): string {
  return `${key}: "${id}" is not a rule we ship; set it in your own ESLint or oxlint config`
}
