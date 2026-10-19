import { describe, expect, it } from 'vitest'

import candidates from '../data/rule-candidates.json' with { type: 'json' }
import canonicalRules from '../data/rules.json' with { type: 'json' }
import { CANDIDATE_STATUSES, NOT_REVIEWED_WHY, UNSHIPPED_STATUSES } from './__tests__/cases/candidate-states.ts'
import { DROPPED_RULES } from './__tests__/cases/dropped-rules.ts'
import { ROUND_2_DROPS, RULES_NEEDING_NEWER_NODE } from './__tests__/cases/round-2-drops.ts'
import { catalog } from './catalog.ts'
import { pluginPrefixOf } from './rule-id-parts.ts'

// A rule is in one state at a time: shipped (data/rules.json), or here, as a rule we may ship, one we
// decided against, or one nobody has reviewed. Every installed rule we do not ship is here.

const STATUSES: ReadonlySet<string> = new Set([...CANDIDATE_STATUSES, ...UNSHIPPED_STATUSES])
const RECORDED_DATE = /^\d{4}-\d{2}-\d{2}$/u

const shippedIds: ReadonlySet<string> = new Set(canonicalRules.map((rule) => rule.id))

// Every prefix of a RuleId, and null for core rules: the engines and plugins we install.
const installedPrefixes: ReadonlySet<string | null> = new Set([...catalog.rules.keys()].map(pluginPrefixOf))

function candidateFor(id: string) {
  const candidate = candidates.find((entry) => entry.id === id)
  if (candidate === undefined) throw new Error(`${id} is not in data/rule-candidates.json`)
  return candidate
}

function isFilledIn(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

describe('the rules we do not ship, data/rule-candidates.json', () => {
  describe('offenders, each list empty', () => {
    it('has no ID out of strictly ascending order, so none is listed twice', () => {
      const ids = candidates.map((candidate) => candidate.id)
      const outOfOrder = ids.flatMap((id, index) => {
        const previous = ids[index - 1]
        return previous !== undefined && previous >= id ? [[previous, id]] : []
      })

      expect(outOfOrder).toStrictEqual([])
    })

    it('has no status other than considering, recommended, parked, needs-owner, dropped or not-reviewed', () => {
      const unknownStatus = candidates
        .filter((candidate) => !STATUSES.has(candidate.status))
        .map((candidate) => `${candidate.id} (${String(candidate.status)})`)

      expect(unknownStatus).toStrictEqual([])
    })

    it('has no entry without a reason, an evidence pointer and the date it was recorded', () => {
      const incomplete = candidates
        .filter(
          (candidate) =>
            !isFilledIn(candidate.why) ||
            !isFilledIn(candidate.evidence) ||
            typeof candidate.recorded !== 'string' ||
            !RECORDED_DATE.test(candidate.recorded),
        )
        .map((candidate) => candidate.id)

      expect(incomplete).toStrictEqual([])
    })

    it('has no rule that also ships in data/rules.json, so each rule is in one state', () => {
      const alsoShipped = candidates.filter((candidate) => shippedIds.has(candidate.id)).map((candidate) => candidate.id)

      expect(alsoShipped).toStrictEqual([])
    })

    // Our engines and plugins list every rule they have, so a candidate under one of their prefixes
    // that is no RuleId is misspelt, or was removed upstream.
    it('has no rule from an engine or plugin we install that is not a RuleId', () => {
      const unknownToInstalled = candidates
        .filter((candidate) => installedPrefixes.has(pluginPrefixOf(candidate.id)) && !catalog.rules.has(candidate.id))
        .map((candidate) => candidate.id)

      expect(unknownToInstalled).toStrictEqual([])
    })

    // A plugin or engine upgrade that adds rules fails here, each new RuleId named.
    it('has no installed rule we do not ship without an entry', () => {
      const candidateIds = new Set(candidates.map(({ id }) => id))
      const unrecorded = [...catalog.rules.values()].filter(({ id, shipped }) => shipped === null && !candidateIds.has(id)).map(({ id }) => id)

      expect(unrecorded).toStrictEqual([])
    })

    it('has no not-reviewed entry whose reason is other than "not reviewed yet"', () => {
      expect(candidates.filter(({ status, why }) => status === 'not-reviewed' && why !== NOT_REVIEWED_WHY).map(({ id }) => id)).toStrictEqual([])
    })

    // Who decided is on the dropped entries alone: the others are no decision.
    it('has no entry but a dropped one naming the card or decision behind it', () => {
      expect(candidates.filter((entry) => entry.status !== 'dropped' && 'decidedBy' in entry).map(({ id }) => id)).toStrictEqual([])
    })
  })

  describe('pinned entries', () => {
    // Too early: a value a design needs stays custom until a token exists for it.
    it('considers shadcn/no-arbitrary-values, whose plugin we do not install, so it is no RuleId', () => {
      expect({
        status: candidateFor('shadcn/no-arbitrary-values').status,
        isRuleId: catalog.rules.has('shadcn/no-arbitrary-values'),
      }).toStrictEqual({ status: 'considering', isRuleId: false })
    })

    // Shipped off until a category for the newest language features, enabled by Node version, exists.
    it('parks each modern-js rule whose fix writes an API Node 22 lacks', () => {
      expect(candidates.filter(({ id }) => RULES_NEEDING_NEWER_NODE.includes(id)).map(({ id, status }) => [id, status])).toStrictEqual(
        RULES_NEEDING_NEWER_NODE.map((id) => [id, 'parked']),
      )
    })

    // A later sweep sees why each was dropped, and does not propose it again unknowingly.
    it('records as dropped exactly the rules decided against, each naming the card or decision that dropped it', () => {
      const dropped = candidates.filter(({ status }) => status === 'dropped').map((entry) => [entry.id, 'decidedBy' in entry ? entry.decidedBy : 'no card named'])

      expect(Object.fromEntries(dropped)).toStrictEqual(DROPPED_RULES)
    })

    it('records each round 2 drop as dropped', () => {
      const dropped = new Set(ROUND_2_DROPS.flatMap(({ dropped: ids }) => ids))

      expect(candidates.filter(({ id }) => dropped.has(id)).map(({ id, status }) => [id, status])).toStrictEqual([...dropped].toSorted().map((id) => [id, 'dropped']))
    })
  })
})
