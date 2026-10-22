import { isDeepStrictEqual } from 'node:util'
import { type AllowanceLeftTo, catalog, routeOf, type RuleRoute } from '@workspace/rule-data'
import { isRecord } from '../core/is-record.ts'

/** Whether the rule the entry is left to ships for some files alone: throws for a rule the catalog does not ship. */
export function isLeftToARuleKeptToSomeFiles({ rule }: AllowanceLeftTo): boolean {
  const { shipped } = routeOf(rule, catalog)
  if (shipped === null) throw new Error(`${rule}: an options entry is left to it, yet the catalog does not ship it`)
  return shipped.files !== null || shipped.ignores !== null
}

/** The rule's shipped options, without each entry it leaves to another rule that `isDropped` picks: throws for a rule not shipped. */
export function shippedOptionsWithout(rule: Readonly<RuleRoute>, isDropped: (allowance: AllowanceLeftTo) => boolean): readonly unknown[] {
  if (rule.shipped === null) throw new Error(`${rule.id}: not shipped, so it has no shipped options`)
  const dropped = rule.shipped.allowancesLeftTo.filter(isDropped)
  return rule.shipped.options.map((given) => dropped.reduce(withoutTheEntry, given))
}

function withoutTheEntry(given: unknown, { option, entry }: AllowanceLeftTo): unknown {
  if (!isRecord(given)) return given
  const listed = given[option]
  if (!Array.isArray(listed)) return given
  return { ...given, [option]: listed.filter((held: unknown) => !isDeepStrictEqual(held, entry)) }
}
