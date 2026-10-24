import { describe, expect, it } from 'vitest'

import candidates from '../data/rule-candidates.json' with { type: 'json' }
import canonicalRules from '../data/rules.json' with { type: 'json' }
import { acceptedRulesOutOfPlace, heldCasesOutOfPlace } from './__tests__/accepted-rules-out-of-place.ts'
import { ACCEPTED_A_HELD_CASES } from './__tests__/cases/accepted-a.ts'
import { ACCEPTED_ON_2026_10_24 } from './__tests__/cases/accepted-on-2026-10-24.ts'

// A rule the owner accepted stays accepted until it ships or a later card drops it, so no sweep drops it, re-proposes it
// or loses it while its build waits. A lane's case of a rule whose build waits on a card is held, unrun, only until it ships.

describe('the rules the owner accepted on 2026-10-24', () => {
  it('each ships, waits in data/rule-candidates.json as it was accepted to, or is recorded dropped by the later card that dropped it and does not ship, its why naming the card that accepted it and the card its build waits on or that dropped it', () => {
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect(acceptedRulesOutOfPlace(ACCEPTED_ON_2026_10_24, shippedIds, candidates)).toStrictEqual([])
  })

  it('have a case held unrun only while the rule is accepted and does not ship, the case naming the card it waits on', () => {
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect(heldCasesOutOfPlace(ACCEPTED_A_HELD_CASES, ACCEPTED_ON_2026_10_24, shippedIds)).toStrictEqual([])
  })
})
