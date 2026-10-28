// What the installed oxlint gives read-installed.ts: the rule list `oxlint --rules --format=json` prints, and its
// package.json.

const A_RULE_SCOPE = 'eslint'
const A_RULE_NAME = 'no-debugger'
const A_CATEGORY = 'correctness'

/** One entry of the rule list, as oxlint prints it. */
export function buildOxlintRuleListing(
  scope: string,
  ruleName: string,
  { typeAware, category }: { readonly typeAware: boolean; readonly category: string },
): Readonly<Record<string, unknown>> {
  return { scope, value: ruleName, type_aware: typeAware, category }
}

/** An entry of the rule list with the one field given set to the value given: left out where it is undefined, as JSON drops it. */
export function buildOxlintRuleListingWith(field: string, value: unknown): Readonly<Record<string, unknown>> {
  return { ...buildOxlintRuleListing(A_RULE_SCOPE, A_RULE_NAME, { typeAware: false, category: A_CATEGORY }), [field]: value }
}

/** What oxlint prints as its rule list: the value given, as JSON. */
export function buildPrintedRuleList(printed: unknown): string {
  return JSON.stringify(printed)
}

/** oxlint's package.json holding the fields given, as JSON. */
export function buildOxlintManifest(fields: unknown): string {
  return JSON.stringify(fields)
}
