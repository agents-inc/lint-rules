import { describe, expect, it } from 'vitest'
import {
  CATALOG_WITH_A_DOMAIN_TO_QUOTE,
  CATALOG_WITH_AN_EMPTY_FLAT_LIST,
  CATALOG_WITH_OPT_IN_RULESETS,
  CATALOG_WITH_SORTING_RULESETS,
  TEXT_WITH_A_DOMAIN_TO_QUOTE,
  TEXT_WITH_AN_EMPTY_FLAT_LIST,
  TEXT_WITH_OPT_IN_RULESETS,
  TEXT_WITH_SORTING_RULESETS,
} from '../../__tests__/cases/init-config-texts.ts'
import { initConfigText } from './config-text.ts'

// I-2 and I-13 (q-i6, q30a, q-i7): the text init writes comes from the ruleset definitions, in data
// order: the agent set lists every ruleset that is not opt-in, each opt-in one is named only in a
// comment above its list's key, and the editor set lists none, under its comment.

describe('the text of agents-inc.lint.mts that init writes', () => {
  it('lists each ruleset that is not opt-in in data order, names the opt-in ones in a comment above their list, and writes a domain whose every ruleset is opt-in as []', () => {
    expect(initConfigText(CATALOG_WITH_OPT_IN_RULESETS)).toBe(TEXT_WITH_OPT_IN_RULESETS)
  })

  it('writes a list with no ruleset left in it as [], under its comment, and libs with no domain as {}', () => {
    expect(initConfigText(CATALOG_WITH_AN_EMPTY_FLAT_LIST)).toBe(TEXT_WITH_AN_EMPTY_FLAT_LIST)
  })

  // Owner, 2026-10-15: a ruleset that sorts code conflicts with a formatter that sorts the same code,
  // so the comment naming the opt-in ones says so of each that sorts. The two texts above, whose
  // opt-in rulesets sort nothing, carry no warning.
  it('names the opt-in rulesets that sort code again under the opt-in comment, in data order, with the formatter warning, and lists a sorting ruleset that is not opt-in under none', () => {
    expect(initConfigText(CATALOG_WITH_SORTING_RULESETS)).toBe(TEXT_WITH_SORTING_RULESETS)
  })

  it('writes a libs domain whose name is no identifier as a quoted key, beside one whose name is', () => {
    expect(initConfigText(CATALOG_WITH_A_DOMAIN_TO_QUOTE)).toBe(TEXT_WITH_A_DOMAIN_TO_QUOTE)
  })
})
