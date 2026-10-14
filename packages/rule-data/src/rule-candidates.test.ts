import { describe, expect, it } from 'vitest'

import candidates from '../data/rule-candidates.json' with { type: 'json' }
import canonicalRules from '../data/rules.json' with { type: 'json' }
import { catalog } from './catalog.ts'
import { pluginPrefixOf } from './rule-id-parts.ts'

// Owner, 2026-10-10: a durable list of the rules under consideration. A rule is in one state at a
// time: shipped (data/rules.json), considered (here), or neither.

const CANDIDATE_STATUSES: ReadonlySet<string> = new Set(['considering', 'recommended', 'parked', 'needs-owner'])
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

describe('the considering list, data/rule-candidates.json', () => {
  describe('offenders, each list empty', () => {
    it('has no ID out of strictly ascending order, so none is listed twice', () => {
      const ids = candidates.map((candidate) => candidate.id)
      const outOfOrder = ids.flatMap((id, index) => {
        const previous = ids[index - 1]
        return previous !== undefined && previous >= id ? [[previous, id]] : []
      })

      expect(outOfOrder).toStrictEqual([])
    })

    it('has no status other than considering, recommended, parked or needs-owner', () => {
      const unknownStatus = candidates
        .filter((candidate) => !CANDIDATE_STATUSES.has(candidate.status))
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
  })

  describe('pinned entries', () => {
    // Owner, 2026-10-10: too early. A value a design needs stays custom until a token exists for it.
    it('considers shadcn/no-arbitrary-values, whose plugin we do not install, so it is no RuleId', () => {
      expect({
        status: candidateFor('shadcn/no-arbitrary-values').status,
        isRuleId: catalog.rules.has('shadcn/no-arbitrary-values'),
      }).toStrictEqual({ status: 'considering', isRuleId: false })
    })
  })
})
