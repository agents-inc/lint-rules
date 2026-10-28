import type { ESLint, Rule } from 'eslint'
import type { Catalog, OxlintCategory, OxlintRule, RuleRoute, RulesetDefinition, ShippedRule } from '@workspace/rule-data'
import { buildShippedRuleDecidedBySuppressions, type ShippedRuleFields } from '@workspace/rule-data/test-support/shipped-rule-factories'
import type { buildEslintConfig } from '../../core/build-eslint-config.ts'

// Small catalogs, so a unit spec states exactly the rules and rulesets its assertion depends on.

type PluginRegistry = Parameters<typeof buildEslintConfig>[2]

type OxlintRouteFields = {
  oxlintName: string
  oxlintPlugin: string
  shipped: ShippedRule | null
  eslintAliases?: readonly string[]
  /** Every name oxlint accepts for the rule. Its oxlint name alone unless given. */
  oxlintSpellings?: readonly string[]
}

type EslintRouteFields = Pick<RuleRoute, 'typed' | 'shipped'> & {
  /** The names oxlint accepts for the rule when oxlint implements it too. None unless given. */
  oxlintSpellings?: readonly string[]
}

// No unit spec built on a small catalog reads a rule's category, so every oxlint rule has this one.
const OXLINT_CATEGORY: OxlintCategory = 'correctness'

const doNothingRule: Rule.RuleModule = {
  meta: { schema: false },
  create() {
    return {}
  },
}

/** Reports once per file, on the file's first token, whatever its options. */
const reportEveryFileRule: Rule.RuleModule = {
  meta: { schema: false, messages: { reported: 'reported by a team rule' } },
  create(context) {
    return {
      Program(node) {
        context.report({ node, messageId: 'reported' })
      },
    }
  },
}

// The builds read neither flag (init does), so a small catalog's rulesets are neither opt-in nor sort code.
const IS_OPT_IN = false
const DOES_SORT_CODE = false

export function buildQualityRuleset(name: string): RulesetDefinition {
  return { name, list: 'quality', domain: null, env: null, optIn: IS_OPT_IN, sortsCode: DOES_SORT_CODE }
}

export function buildLibsRuleset(name: string, domain: string): RulesetDefinition {
  return { name, list: 'libs', domain, env: null, optIn: IS_OPT_IN, sortsCode: DOES_SORT_CODE }
}

export function buildRuntimeRuleset(name: string, env: string): RulesetDefinition {
  return { name, list: 'runtimes', domain: null, env, optIn: IS_OPT_IN, sortsCode: DOES_SORT_CODE }
}

/** On where suppressions are banned, the default, and off where allowed, as `house/no-suppressions` ships. */
export function buildSuppressionModeShippedRule(fields: ShippedRuleFields = {}): ShippedRule {
  return buildShippedRuleDecidedBySuppressions({ banned: { options: [] }, allowed: 'off' }, fields)
}

/** `shipped: null` is a rule that is available but in no ruleset: off until `rules` turns it on. */
export function buildOxlintRoute(id: string, fields: Readonly<OxlintRouteFields>): RuleRoute {
  return { id, engine: 'oxlint', typed: false, eslintAliases: [], oxlintSpellings: [fields.oxlintName], ...fields }
}

export function buildEslintRoute(id: string, fields: Readonly<EslintRouteFields>): RuleRoute {
  return { id, engine: 'eslint', oxlintName: null, oxlintPlugin: null, eslintAliases: [], oxlintSpellings: [], ...fields }
}

/**
* `eslintFallbackSkips`, `coreRuleExtensions` and `eslintStandIns` are empty unless given. oxlint has the oxlint
* routes given; ESLint has each ESLint route given and no oxlint route.
*/
export function buildCatalog({
  rulesets,
  rules,
  eslintFallbackSkips = new Map(),
  coreRuleExtensions = new Map(),
  eslintStandIns = new Map(),
}: {
  readonly rulesets: readonly RulesetDefinition[]
  readonly rules: readonly RuleRoute[]
  readonly eslintFallbackSkips?: ReadonlyMap<string, string>
  readonly coreRuleExtensions?: ReadonlyMap<string, readonly string[]>
  readonly eslintStandIns?: ReadonlyMap<string, string>
}): Catalog {
  return {
    rulesets,
    rules: new Map(rules.map((rule) => [rule.id, rule])),
    eslintFallbackSkips,
    oxlintRules: rules.flatMap(oxlintRuleOf),
    coreRuleExtensions,
    ruleIdsWithAnEslintVersion: new Set(rules.filter(({ engine }) => engine === 'eslint').map(({ id }) => id)),
    eslintStandIns,
  }
}

function oxlintRuleOf({ id, oxlintName, oxlintPlugin }: Readonly<RuleRoute>): OxlintRule[] {
  return oxlintName === null ? [] : [{ id, oxlintName, oxlintPlugin, category: OXLINT_CATEGORY }]
}

/** An ESLint plugin whose rules report nothing and accept any options. Each rule is its own object. */
export function buildFakePlugin(ruleNames: readonly string[], fields: Pick<ESLint.Plugin, 'meta'> = {}): ESLint.Plugin {
  return { ...fields, rules: Object.fromEntries(ruleNames.map((ruleName) => [ruleName, { ...doNothingRule }])) }
}

/** Every rule reports each file once, so a spec sees a team's own rule fire. */
export function buildReportingPlugin(ruleNames: readonly string[], fields: Pick<ESLint.Plugin, 'meta'> = {}): ESLint.Plugin {
  return { ...fields, rules: Object.fromEntries(ruleNames.map((ruleName) => [ruleName, { ...reportEveryFileRule }])) }
}

/** The ESLint plugin registry, keyed by rule-ID prefix, with a fake plugin per prefix. */
export function buildPluginRegistry(
  ruleNamesByPrefix: Readonly<Record<string, readonly string[]>>,
): PluginRegistry {
  return Object.fromEntries(
    Object.entries(ruleNamesByPrefix).map(([prefix, ruleNames]) => [prefix, buildFakePlugin(ruleNames)]),
  )
}
