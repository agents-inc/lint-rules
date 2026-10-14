import { catalog } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'

/** A rule a config turns on, under its canonical ID, with the engine and the options it runs with. */
export type RuleOnEngine = { readonly id: string; readonly engine: 'oxlint' | 'eslint'; readonly options: readonly unknown[] }

// Every rule oxlint has, whichever engine the catalog routes it to, so a config stating a rule ESLint
// runs reads as stating it rather than failing to read.
const canonicalIdByOxlintName: ReadonlyMap<string, string> = new Map(catalog.oxlintRules.map(({ oxlintName, id }) => [oxlintName, id]))

export function canonicalIdOfOxlintName(oxlintName: string): string {
  const id = canonicalIdByOxlintName.get(oxlintName)
  if (id === undefined) throw new Error(`oxlint has no rule named ${oxlintName}`)
  return id
}

/** An entry that turns a rule on: the package always writes one as `[severity, ...options]`. */
export function isOn(entry: unknown): entry is readonly [unknown, ...unknown[]] {
  return Array.isArray(entry) && entry[0] !== 'off' && entry[0] !== 0
}

/** Every rule the config turns on, at the top level or in an override, once per place it is turned on. */
export function rulesOnInOxlint({ rules = {}, overrides = [] }: OxlintConfig): RuleOnEngine[] {
  // An override may switch only env, with no rules.
  const ruleMaps = [rules, ...overrides.map((override) => override.rules ?? {})]
  return ruleMaps.flatMap((ruleMap) =>
    Object.entries(ruleMap).flatMap(([oxlintName, entry]): RuleOnEngine[] =>
      isOn(entry) ? [{ id: canonicalIdOfOxlintName(oxlintName), engine: 'oxlint', options: entry.slice(1) }] : [],
    ),
  )
}

/** Every rule the blocks turn on, once per block that turns it on. */
export function rulesOnInEslint(config: readonly Linter.Config[]): RuleOnEngine[] {
  return config.flatMap((block) =>
    Object.entries(block.rules ?? {}).flatMap(([id, entry]): RuleOnEngine[] =>
      isOn(entry) ? [{ id, engine: 'eslint', options: entry.slice(1) }] : [],
    ),
  )
}

/** Every rule ID the blocks set, to any severity, once each and sorted. */
export function ruleIdsStatedInEslint(config: readonly Linter.Config[]): string[] {
  return [...new Set(config.flatMap((block) => Object.keys(block.rules ?? {})))].toSorted()
}

/** A rule on the engine the catalog routes it to, with the options given. */
export function onItsEngine(id: string, options: readonly unknown[]): RuleOnEngine {
  const rule = catalog.rules.get(id)
  if (rule === undefined) throw new Error(`${id} is not a RuleId`)
  return { id, engine: rule.engine, options }
}

/** A rule run by ESLint, with the options given. */
export function onEslint(id: string, options: readonly unknown[]): RuleOnEngine {
  return { id, engine: 'eslint', options }
}

export function uniqueById(rules: readonly RuleOnEngine[]): RuleOnEngine[] {
  return sortedById([...new Map(rules.map((rule) => [rule.id, rule])).values()])
}

export function sortedById(rules: readonly RuleOnEngine[]): RuleOnEngine[] {
  return rules.toSorted((a, b) => a.id.localeCompare(b.id))
}
