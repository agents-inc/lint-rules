import { catalog, type RuleRoute } from '@workspace/rule-data'

/** Whether the rule is shipped as covered by another rule that is shipped too: throws for a cover the catalog does not hold. */
export function isCoveredByAShippedRule({ shipped }: Readonly<RuleRoute>): boolean {
  if (shipped === null || typeof shipped.coveredBy !== 'string') return false
  const cover = catalog.rules.get(shipped.coveredBy)
  if (cover === undefined) throw new Error(`${shipped.coveredBy}: a cover the catalog does not hold`)
  return cover.shipped !== null
}

/** Whether the rule is shipped as covered, where oxlint runs, by another rule that is shipped too: throws for a cover the catalog does not hold. */
export function isCoveredInOxlintByAShippedRule({ shipped }: Readonly<RuleRoute>): boolean {
  if (shipped === null) return false
  const { coveredInOxlintBy } = shipped
  if (coveredInOxlintBy === null) return false
  const cover = catalog.rules.get(coveredInOxlintBy)
  if (cover === undefined) throw new Error(`${coveredInOxlintBy}: a cover in oxlint the catalog does not hold`)
  return cover.shipped !== null
}
