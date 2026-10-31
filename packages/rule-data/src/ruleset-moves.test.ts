import { describe, expect, it } from 'vitest'

import candidates from '../data/rule-candidates.json' with { type: 'json' }
import canonicalRules from '../data/rules.json' with { type: 'json' }
import { KEPT_UNSHIPPED, RULESET_MOVES } from './__tests__/cases/ruleset-moves.ts'

describe('the rules the owner moved to another ruleset, data/rules.json', () => {
  it('ships each in its new ruleset, its assignment naming the decision that moved it, with no alternative left', () => {
    const moved = canonicalRules.filter(({ id }) => Object.hasOwn(RULESET_MOVES, id)).map(({ id, ruleset, assignment }) => [id, { ruleset, assignment }])

    expect(Object.fromEntries(moved)).toStrictEqual(RULESET_MOVES)
  })
})

describe('the rule the owner kept unshipped, data/rule-candidates.json', () => {
  it('keeps its entry parked', () => {
    expect(candidates.find(({ id }) => id === KEPT_UNSHIPPED)?.status).toBe('parked')
  })
})
