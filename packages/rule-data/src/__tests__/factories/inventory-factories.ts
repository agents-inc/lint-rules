import type { OxlintCategory, RuleRoute, ShippedRule } from '../../catalog.ts'
import type {
  EslintImplementation,
  Inventory,
  InventoryRule,
  OxlintImplementation,
} from '../../generate/build-inventory.ts'
import type { CanonicalRule } from '../../generate/build-routing.ts'
import type {
  InstalledEngines,
  InstalledEslintRule,
  InstalledOxlintRule,
} from '../../generate/read-installed.ts'

const OXLINT_VERSION = '1.87.0'
const ESLINT_VERSION = '10.12.0'
// No join or route reads a rule's category, so both oxlint factories file it under one, alike.
const OXLINT_CATEGORY: OxlintCategory = 'correctness'

/**
 * What the generator reads from the installed engines: exactly these rules. Joining them never
 * reads the versions, so they are fixed here rather than asked for.
 */
export function buildInstalledEngines(
  rules: Pick<InstalledEngines, 'eslintRules' | 'oxlintRules'>,
): InstalledEngines {
  return {
    versions: { oxlint: OXLINT_VERSION, eslint: ESLINT_VERSION, eslintPlugins: {} },
    ...rules,
  }
}

/** One line of `oxlint --rules`, under the name oxlint prints. */
export function buildInstalledOxlintRule(
  oxlintName: string,
  fields: Omit<InstalledOxlintRule, 'oxlintName' | 'category'> & Partial<Pick<InstalledOxlintRule, 'category'>>,
): InstalledOxlintRule {
  return { oxlintName, category: OXLINT_CATEGORY, ...fields }
}

/** One rule of ESLint core or of a registered plugin, under its ESLint ID. */
export function buildInstalledEslintRule(
  id: string,
  fields: Omit<InstalledEslintRule, 'id'>,
): InstalledEslintRule {
  return { id, ...fields }
}

/**
 * An inventory holding exactly these rules. Routing never reads the versions, so they are fixed
 * here rather than asked for.
 */
export function buildInventory(rules: readonly InventoryRule[]): Inventory {
  return {
    versions: { oxlint: OXLINT_VERSION, eslint: ESLINT_VERSION, eslintPlugins: {} },
    rules,
  }
}

/**
 * One canonical ID as the installed engines know it. Both implementations are required, `null`
 * included, because the route depends on which of them exist.
 */
export function buildInventoryRule(
  id: string,
  implementations: Pick<InventoryRule, 'oxlint' | 'eslint'>,
): InventoryRule {
  return { id, ...implementations }
}

export function buildOxlintImplementation(
  oxlintName: string,
  fields: Omit<OxlintImplementation, 'oxlintName' | 'category'> & Partial<Pick<OxlintImplementation, 'category'>>,
): OxlintImplementation {
  return { oxlintName, category: OXLINT_CATEGORY, ...fields }
}

export function buildEslintImplementation(fields: EslintImplementation): EslintImplementation {
  return { ...fields }
}

/**
 * One entry of `data/rules.json`. Everything routing reads is required; only `assignment`, which
 * routing ignores, is filled in.
 */
export function buildCanonicalRule(
  id: string,
  fields: Pick<CanonicalRule, 'engine' | 'options' | 'ruleset' | 'typed'> &
    Partial<Pick<CanonicalRule, 'files' | 'ignores' | 'oxlintName'>>,
): CanonicalRule {
  return { id, assignment: { confidence: 'high', by: 'plugin' }, ...fields }
}

/** A route's `shipped`: turned on by its ruleset, with no options, on every file unless given. */
export function buildShippedRule(
  ruleset: string,
  fields: Partial<Pick<ShippedRule, 'options' | 'files' | 'ignores'>> = {},
): ShippedRule {
  return { ruleset, options: [], files: null, ignores: null, ...fields }
}

/** The route of a rule oxlint runs: oxlint never has type information, so `typed` is false. */
export function buildOxlintRoute(
  id: string,
  fields: Pick<RuleRoute, 'eslintAliases' | 'oxlintSpellings' | 'shipped'> & {
    oxlintName: string
    oxlintPlugin: string
  },
): RuleRoute {
  return { id, engine: 'oxlint', typed: false, ...fields }
}

/**
 * The route of a rule ESLint runs: no oxlint name, no oxlint plugin and no aliases to switch off.
 * `oxlintSpellings` is required: a rule oxlint also implements keeps oxlint's spellings of it.
 */
export function buildEslintRoute(
  id: string,
  fields: Pick<RuleRoute, 'oxlintSpellings' | 'shipped' | 'typed'>,
): RuleRoute {
  return { id, engine: 'eslint', oxlintName: null, oxlintPlugin: null, eslintAliases: [], ...fields }
}
