import type { ESLint, Rule } from 'eslint'
import type { Catalog, OxlintCategory, OxlintRule, RuleRoute, RulesetDefinition, ShippedRule } from '@workspace/rule-data'
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
  create: () => ({}),
}

/** Reports once per file, on the file's first token, whatever its options. */
const reportEveryFileRule: Rule.RuleModule = {
  meta: { schema: false, messages: { reported: 'reported by a team rule' } },
  create: (context) => ({
    Program: (node) => {
      context.report({ node, messageId: 'reported' })
    },
  }),
}

export function buildQualityRuleset(name: string): RulesetDefinition {
  return { name, list: 'quality', domain: null, env: null }
}

export function buildLibsRuleset(name: string, domain: string): RulesetDefinition {
  return { name, list: 'libs', domain, env: null }
}

export function buildRuntimeRuleset(name: string, env: string): RulesetDefinition {
  return { name, list: 'runtimes', domain: null, env }
}

export function buildLanguageRuleset(name: string): RulesetDefinition {
  return { name, list: 'languages', domain: null, env: null }
}

/** A rule in the canonical list. `options`, `files` and `ignores` default to none. */
export function buildShippedRule(
  ruleset: string,
  fields: Partial<Omit<ShippedRule, 'ruleset'>> = {},
): ShippedRule {
  return { ruleset, options: [], files: null, ignores: null, ...fields }
}

/** `shipped: null` is a rule that is available but in no ruleset: off until `rules` turns it on. */
export function buildOxlintRoute(id: string, fields: OxlintRouteFields): RuleRoute {
  return { id, engine: 'oxlint', typed: false, eslintAliases: [], oxlintSpellings: [fields.oxlintName], ...fields }
}

export function buildEslintRoute(id: string, fields: EslintRouteFields): RuleRoute {
  return { id, engine: 'eslint', oxlintName: null, oxlintPlugin: null, eslintAliases: [], oxlintSpellings: [], ...fields }
}

/**
 * `eslintFallbackSkips`, rule ID to reason, and `coreRuleExtensions`, core rule ID to the rules
 * extending it, are empty unless given. The rules oxlint has are the oxlint routes given, so one
 * list feeds both. ESLint has a version of each ESLint route given, since it runs it, and of no
 * oxlint route.
 */
export function buildCatalog({
  rulesets,
  rules,
  eslintFallbackSkips = new Map(),
  coreRuleExtensions = new Map(),
}: {
  rulesets: readonly RulesetDefinition[]
  rules: readonly RuleRoute[]
  eslintFallbackSkips?: ReadonlyMap<string, string>
  coreRuleExtensions?: ReadonlyMap<string, readonly string[]>
}): Catalog {
  return {
    rulesets,
    rules: new Map(rules.map((rule) => [rule.id, rule])),
    eslintFallbackSkips,
    oxlintRules: rules.flatMap(oxlintRuleOf),
    coreRuleExtensions,
    ruleIdsWithAnEslintVersion: new Set(rules.filter(({ engine }) => engine === 'eslint').map(({ id }) => id)),
  }
}

function oxlintRuleOf({ id, oxlintName, oxlintPlugin }: RuleRoute): OxlintRule[] {
  return oxlintName === null || oxlintPlugin === null ? [] : [{ id, oxlintName, oxlintPlugin, category: OXLINT_CATEGORY }]
}

/** An ESLint plugin whose rules report nothing and accept any options. Each rule is its own object. */
export function buildFakePlugin(ruleNames: readonly string[], fields: Pick<ESLint.Plugin, 'meta'> = {}): ESLint.Plugin {
  return { ...fields, rules: Object.fromEntries(ruleNames.map((ruleName) => [ruleName, { ...doNothingRule }])) }
}

/** An ESLint plugin whose every rule reports each file it lints once: a team's own rule, whose firing a spec can see. */
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
