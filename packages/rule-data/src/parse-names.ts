import type { Engine, OxlintCategory, RulesetList } from './catalog.ts'

const RULESET_LISTS: readonly RulesetList[] = ['quality', 'libs', 'runtimes', 'languages']

const OXLINT_CATEGORIES: readonly OxlintCategory[] = [
  'correctness',
  'nursery',
  'pedantic',
  'perf',
  'restriction',
  'style',
  'suspicious',
]

/** JSON gives every string the type `string`; these narrow the ones our data restricts. */
export function parseEngine(value: string): Engine {
  if (!isEngine(value)) throw new Error(`"${value}" is not an engine (oxlint or eslint)`)
  return value
}

export function parseRulesetList(value: string): RulesetList {
  if (!isRulesetList(value)) throw new Error(`"${value}" is not a ruleset list (${RULESET_LISTS.join(', ')})`)
  return value
}

export function parseOxlintCategory(value: string): OxlintCategory {
  if (!isOxlintCategory(value)) throw new Error(`"${value}" is not an oxlint category (${OXLINT_CATEGORIES.join(', ')})`)
  return value
}

function isOxlintCategory(value: string): value is OxlintCategory {
  return OXLINT_CATEGORIES.some((category) => category === value)
}

function isEngine(value: string): value is Engine {
  return value === 'oxlint' || value === 'eslint'
}

function isRulesetList(value: string): value is RulesetList {
  return RULESET_LISTS.some((list) => list === value)
}
