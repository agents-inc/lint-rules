import { describe, expect, it } from 'vitest'

import { type AcceptedRule, acceptedRulesOutOfPlace, type HeldCase, heldCasesOutOfPlace, type WaitingRule } from './accepted-rules-out-of-place.ts'

const HELD_BY = 'q-held'
const OTHER_CARD = 'q-other-held'
const DROPPED_BY = 'q-dropped'

function acceptedAs(waitsAs: WaitingRule['waitsAs'], id: string): WaitingRule {
  return { card: `rc-${id}`, waitsAs }
}

function heldAs(waitsAs: WaitingRule['waitsAs'], id: string): WaitingRule {
  return { ...acceptedAs(waitsAs, id), heldBy: HELD_BY }
}

function droppedAs(id: string): AcceptedRule {
  return { card: `rc-${id}`, droppedBy: DROPPED_BY }
}

function entryOf(id: string, status: string, why: string): { readonly id: string; readonly status: string; readonly why: string } {
  return { id, status, why }
}

function droppedEntryOf(id: string, decidedBy: string, why: string): { readonly id: string; readonly status: string; readonly decidedBy: string; readonly why: string } {
  return { id, status: 'dropped', decidedBy, why }
}

function heldCaseOf(rule: string, heldBy: string): HeldCase {
  return { heldBy, ruleCase: { rule } }
}

function acceptedWaitingOnItsCard({ heldBy, ruleCase }: HeldCase): [string, AcceptedRule] {
  return [ruleCase.rule, { ...acceptedAs('recommended', ruleCase.rule), heldBy }]
}

describe('acceptedRulesOutOfPlace', () => {
  it('names nothing for a rule that ships, nor for one waiting as it was accepted to, its why naming its cards', () => {
    const accepted = {
      shipped: acceptedAs('recommended', 'shipped'),
      waiting: acceptedAs('recommended', 'waiting'),
      held: heldAs('recommended', 'held'),
      parked: acceptedAs('parked', 'parked'),
    }
    const candidates = [
      entryOf('waiting', 'recommended', 'Owner: "Accept" (rc-waiting); not built yet.'),
      entryOf('held', 'recommended', `Owner: "Accept" (rc-held); not built yet: waits on card ${HELD_BY}.`),
      entryOf('parked', 'parked', 'Owner: "Accept" (rc-parked), off until Node has the API.'),
    ]

    expect(acceptedRulesOutOfPlace(accepted, new Set(['shipped']), candidates)).toStrictEqual([])
  })

  it('names a rule neither shipped nor recorded, one dropped, one in the other waiting state, and a why missing a card, beside one that holds', () => {
    const accepted = {
      lost: acceptedAs('recommended', 'lost'),
      dropped: acceptedAs('recommended', 'dropped'),
      unparked: acceptedAs('parked', 'unparked'),
      'card-missing': acceptedAs('recommended', 'card-missing'),
      'hold-missing': heldAs('recommended', 'hold-missing'),
      holds: acceptedAs('recommended', 'holds'),
    }
    const candidates = [
      entryOf('dropped', 'dropped', 'Owner: "Reject" (rc-dropped).'),
      entryOf('unparked', 'recommended', 'Owner: "Accept" (rc-unparked).'),
      entryOf('card-missing', 'recommended', 'Recommended by the sweep.'),
      entryOf('hold-missing', 'recommended', 'Owner: "Accept" (rc-hold-missing); not built yet.'),
      entryOf('holds', 'recommended', 'Owner: "Accept" (rc-holds); not built yet.'),
    ]

    expect(acceptedRulesOutOfPlace(accepted, new Set(), candidates)).toStrictEqual([
      'lost: neither ships nor has an entry in data/rule-candidates.json',
      'dropped: is dropped, not recommended',
      'unparked: is recommended, not parked',
      'card-missing: its why names no card rc-card-missing',
      `hold-missing: its why names no card ${HELD_BY}`,
    ])
  })

  it('names a rule that ships while its build still waits on a card, beside one shipped with no card to wait on', () => {
    const accepted = {
      'shipped-early': heldAs('recommended', 'shipped-early'),
      shipped: acceptedAs('recommended', 'shipped'),
    }

    expect(acceptedRulesOutOfPlace(accepted, new Set(['shipped-early', 'shipped']), [])).toStrictEqual([`shipped-early: ships while its build waits on card ${HELD_BY}`])
  })

  it('names a rule a later card dropped that ships, has no entry, still waits, was decided by another card, or has a why naming neither card, beside one recorded as that card dropped it', () => {
    const accepted = {
      recorded: droppedAs('recorded'),
      'shipped-anyway': droppedAs('shipped-anyway'),
      unrecorded: droppedAs('unrecorded'),
      'still-waiting': droppedAs('still-waiting'),
      'decided-by-another': droppedAs('decided-by-another'),
      unexplained: droppedAs('unexplained'),
    }
    const candidates = [
      droppedEntryOf('recorded', DROPPED_BY, `Owner: "Accept" (rc-recorded); then "Don't ship it" (${DROPPED_BY}): it reports code written so on purpose.`),
      entryOf('still-waiting', 'recommended', `Owner: "Accept" (rc-still-waiting); not built yet: waits on card ${DROPPED_BY}.`),
      droppedEntryOf('decided-by-another', OTHER_CARD, `Owner: "Accept" (rc-decided-by-another); then "Don't ship it" (${DROPPED_BY}).`),
      droppedEntryOf('unexplained', DROPPED_BY, 'Dropped.'),
    ]

    expect(acceptedRulesOutOfPlace(accepted, new Set(['shipped-anyway']), candidates)).toStrictEqual([
      `shipped-anyway: ships, though card ${DROPPED_BY} dropped it`,
      'unrecorded: neither ships nor has an entry in data/rule-candidates.json',
      'still-waiting: is recommended, not dropped',
      `still-waiting: is not decided by card ${DROPPED_BY}`,
      `decided-by-another: is not decided by card ${DROPPED_BY}`,
      'unexplained: its why names no card rc-unexplained',
      `unexplained: its why names no card ${DROPPED_BY}`,
    ])
  })
})

describe('heldCasesOutOfPlace', () => {
  it('names a held case of a rule the owner did not accept, and one whose rule ships, beside one that waits on its card', () => {
    const accepted = {
      waits: heldAs('recommended', 'waits'),
      shipped: heldAs('recommended', 'shipped'),
    }
    const heldCases = [heldCaseOf('waits', HELD_BY), heldCaseOf('not-accepted', HELD_BY), heldCaseOf('shipped', HELD_BY)]

    expect(heldCasesOutOfPlace(heldCases, accepted, new Set(['shipped']))).toStrictEqual([
      'not-accepted: is held, but is no rule the owner accepted',
      `shipped: ships, so its case runs rather than waiting on card ${HELD_BY}`,
    ])
  })

  it('names a held case whose card is empty, the accepting card, in a sentence, trailed or capitalised, beside one held for a card with a digit', () => {
    const heldCases = [
      heldCaseOf('card-with-digit', 'q-r4-held'),
      heldCaseOf('card-empty', ''),
      heldCaseOf('card-accepting', 'rc-card-accepting'),
      heldCaseOf('card-in-a-sentence', `card ${HELD_BY}`),
      heldCaseOf('card-trailed', `${HELD_BY}.`),
      heldCaseOf('card-capitalised', 'q-lint-Held'),
    ]
    const accepted = Object.fromEntries(heldCases.map(acceptedWaitingOnItsCard))

    expect(heldCasesOutOfPlace(heldCases, accepted, new Set())).toStrictEqual([
      'card-empty: is held for "", which is no card',
      'card-accepting: is held for "rc-card-accepting", which is no card',
      `card-in-a-sentence: is held for "card ${HELD_BY}", which is no card`,
      `card-trailed: is held for "${HELD_BY}.", which is no card`,
      'card-capitalised: is held for "q-lint-Held", which is no card',
    ])
  })

  it('names a held case whose card is not the one its rule waits on, and one whose rule waits on no card, beside one held for the card its rule waits on', () => {
    const accepted = {
      'same-card': heldAs('recommended', 'same-card'),
      'other-card': heldAs('recommended', 'other-card'),
      'no-card': acceptedAs('recommended', 'no-card'),
    }
    const heldCases = [heldCaseOf('same-card', HELD_BY), heldCaseOf('other-card', OTHER_CARD), heldCaseOf('no-card', HELD_BY)]

    expect(heldCasesOutOfPlace(heldCases, accepted, new Set())).toStrictEqual([
      `other-card: is held for card ${OTHER_CARD}, but its build waits on card ${HELD_BY}`,
      `no-card: is held for card ${HELD_BY}, but its build waits on no card`,
    ])
  })

  it('names a held case whose rule a later card dropped, beside one held for the card its rule waits on', () => {
    const accepted = {
      waits: heldAs('recommended', 'waits'),
      dropped: droppedAs('dropped'),
    }
    const heldCases = [heldCaseOf('waits', HELD_BY), heldCaseOf('dropped', HELD_BY)]

    expect(heldCasesOutOfPlace(heldCases, accepted, new Set())).toStrictEqual([`dropped: is held, but card ${DROPPED_BY} dropped its rule`])
  })
})
