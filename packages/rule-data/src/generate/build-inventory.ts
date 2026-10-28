import type { OxlintCategory } from '../catalog.ts'
import { compareCodeUnits, sharedKeys } from '../collections.ts'
import { canonicalIdOf, eslintAliasCandidatesOf, oxlintPluginOf } from '../rule-id-parts.ts'
import type { InstalledEngines, InstalledEslintRule, InstalledOxlintRule } from './read-installed.ts'

export type OxlintImplementation = {
  oxlintName: string
  oxlintPlugin: string
  typeAware: boolean
  /** What a config's `categories` turns it on by, as the installed oxlint lists it. */
  category: OxlintCategory
  /** Every other ESLint spelling of the rule, before routing drops those that are `RuleId`s. */
  eslintAliases: readonly string[]
}

export type EslintImplementation = {
  deprecated: boolean
  typed: boolean
  /** The core rule it extends under another name: present exactly when it extends one. */
  extendsCoreRule?: string
  /** Every other rule ID its plugin binds to its module, sorted: present exactly when there is one. */
  sameModuleAs?: readonly string[]
}

/** One canonical ID and each installed engine's version of it. */
export type InventoryRule = {
  id: string
  oxlint: OxlintImplementation | null
  eslint: EslintImplementation | null
}

export type InventoryVersions = {
  oxlint: string
  eslint: string
  /** ESLint rule-ID prefix → installed version of the package registered under it. */
  eslintPlugins: Readonly<Record<string, string>>
}

export type Inventory = { versions: InventoryVersions; rules: readonly InventoryRule[] }

type OxlintRuleByCanonicalId = { id: string; implementation: OxlintImplementation }

/** Joins the installed engines' rules on their canonical (ESLint) ID, sorted by ID. */
export function buildInventory({ versions, oxlintRules, eslintRules }: Readonly<InstalledEngines>): Inventory {
  const oxlintById = oxlintImplementationsById(oxlintRules)
  const eslintById = eslintImplementationsById(eslintRules)
  const ids = idsEitherEngineHas(oxlintById, eslintById)
  return {
    versions,
    rules: ids.map((id) => ({ id, oxlint: oxlintById.get(id) ?? null, eslint: eslintById.get(id) ?? null })),
  }
}

function idsEitherEngineHas(
  oxlintById: ReadonlyMap<string, OxlintImplementation>,
  eslintById: ReadonlyMap<string, EslintImplementation>,
): readonly string[] {
  return [...new Set([...oxlintById.keys(), ...eslintById.keys()])].toSorted(compareCodeUnits)
}

function oxlintImplementationsById(
  oxlintRules: readonly InstalledOxlintRule[],
): ReadonlyMap<string, OxlintImplementation> {
  const rules = withOneOxlintRulePerCanonicalId(oxlintRules.map(withCanonicalId))
  return new Map(rules.map(({ id, implementation }) => [id, implementation]))
}

function eslintImplementationsById(
  eslintRules: readonly InstalledEslintRule[],
): ReadonlyMap<string, EslintImplementation> {
  return new Map(eslintRules.map(({ id, ...implementation }) => [id, implementation]))
}

function withCanonicalId({ oxlintName, typeAware, category }: Readonly<InstalledOxlintRule>): OxlintRuleByCanonicalId {
  return {
    id: canonicalIdOf(oxlintName),
    implementation: {
      oxlintName,
      oxlintPlugin: oxlintPluginOf(oxlintName),
      typeAware,
      category,
      eslintAliases: eslintAliasCandidatesOf(oxlintName),
    },
  }
}

/** The rules given, once no two of them map to one canonical ID: throws naming each ID two map to. */
function withOneOxlintRulePerCanonicalId(rules: readonly OxlintRuleByCanonicalId[]): readonly OxlintRuleByCanonicalId[] {
  const clashes = sharedKeys(rules, ({ id }) => id)
  if (clashes.length === 0) return rules
  const described = clashes.map(
    ([id, group]) => `${group.map(({ implementation }) => implementation.oxlintName).join(' and ')} → ${id}`,
  )
  throw new Error(`Two oxlint rules map to one canonical ID (fix data/oxlint-scopes.json): ${described.join('; ')}`)
}
