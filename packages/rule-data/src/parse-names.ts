import type { Engine, OxlintCategory, RulesetList } from './catalog.ts'

const ENGINES: readonly Engine[] = ['oxlint', 'eslint']

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
export const parseEngine = oneOf(ENGINES, `an engine (${ENGINES.join(' or ')})`)

export const parseRulesetList = oneOf(RULESET_LISTS, `a ruleset list (${RULESET_LISTS.join(', ')})`)

export const parseOxlintCategory = oneOf(OXLINT_CATEGORIES, `an oxlint category (${OXLINT_CATEGORIES.join(', ')})`)

/** A parser taking each allowed name as itself, and refusing any other as not being `what`. */
function oneOf<Name extends string>(allowed: readonly Name[], what: string): (value: string) => Name {
  return (value) => {
    const name = allowed.find((candidate) => candidate === value)
    if (name === undefined) throw new Error(`"${value}" is not ${what}`)
    return name
  }
}
