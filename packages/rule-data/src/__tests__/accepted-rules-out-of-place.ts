import { type Breach, breachesOf } from './breaches.ts'

// A rule the owner accepted ships, or waits in data/rule-candidates.json in the state it was accepted into,
// its entry naming the card that accepted it and the card its build waits on. A rule whose build waits on a
// card does not ship until the card is answered. A rule a later card dropped never ships: its entry is
// dropped, decided by that card, and names both cards.

/** What an accepted rule's entry in data/rule-candidates.json must say until the rule ships, or from when a later card dropped it. */
export type AcceptedRule = WaitingRule | DroppedRule

/** Accepted, and waiting until it ships. */
export type WaitingRule = {
  /** The card that accepted it, which its entry's `why` names. */
  readonly card: string
  readonly waitsAs: 'recommended' | 'parked'
  /** The card its build waits on, which its entry's `why` names too. */
  readonly heldBy?: string
}

/** Accepted, then dropped by a later card. */
type DroppedRule = {
  /** The card that accepted it, which its entry's `why` names. */
  readonly card: string
  /** The card that dropped it: its entry's `decidedBy`, which its `why` names too. */
  readonly droppedBy: string
}

/** An entry of data/rule-candidates.json, as far as the check reads it. */
type CandidateEntry = { readonly id: string; readonly status: string; readonly why: string; readonly decidedBy?: string | undefined }

const DROPPED = 'dropped'

const NO_ENTRY = 'neither ships nor has an entry in data/rule-candidates.json'

/**
 * `rule: what is wrong` for each accepted rule that neither ships nor waits as it was accepted to, ships while
 * its build waits on a card, or ships or is not recorded dropped by the later card that dropped it.
 */
export function acceptedRulesOutOfPlace(accepted: Readonly<Record<string, AcceptedRule>>, shippedIds: ReadonlySet<string>, candidates: readonly CandidateEntry[]): string[] {
  const candidateById = new Map(candidates.map((entry) => [entry.id, entry]))
  return Object.entries(accepted).flatMap(([id, acceptedRule]) =>
    wrongsOfAnAcceptedRule(acceptedRule, shippedIds.has(id), candidateById.get(id)).map((wrong) => `${id}: ${wrong}`),
  )
}

function wrongsOfAnAcceptedRule(acceptedRule: AcceptedRule, isShipped: boolean, entry: CandidateEntry | undefined): string[] {
  if ('droppedBy' in acceptedRule) return isShipped ? [`ships, though card ${acceptedRule.droppedBy} dropped it`] : wrongsOfADroppedRule(entry, acceptedRule)
  return isShipped ? wrongsOfAShippedRule(acceptedRule) : wrongsOfAWaitingRule(entry, acceptedRule)
}

function wrongsOfAShippedRule({ heldBy }: WaitingRule): string[] {
  return heldBy === undefined ? [] : [`ships while its build waits on card ${heldBy}`]
}

function wrongsOfAWaitingRule(entry: CandidateEntry | undefined, { card, waitsAs, heldBy }: WaitingRule): string[] {
  if (entry === undefined) return [NO_ENTRY]
  const breaches: ReadonlyArray<Breach<CandidateEntry>> = [
    [`is ${entry.status}, not ${waitsAs}`, ({ status }) => status !== waitsAs],
    ...whyNamingEach(heldBy === undefined ? [card] : [card, heldBy]),
  ]
  return breachesOf(entry, breaches)
}

function wrongsOfADroppedRule(entry: CandidateEntry | undefined, { card, droppedBy }: DroppedRule): string[] {
  if (entry === undefined) return [NO_ENTRY]
  const breaches: ReadonlyArray<Breach<CandidateEntry>> = [
    [`is ${entry.status}, not ${DROPPED}`, ({ status }) => status !== DROPPED],
    [`is not decided by card ${droppedBy}`, ({ decidedBy }) => decidedBy !== droppedBy],
    ...whyNamingEach([card, droppedBy]),
  ]
  return breachesOf(entry, breaches)
}

function whyNamingEach(cards: readonly string[]): Array<Breach<CandidateEntry>> {
  return cards.map((named): Breach<CandidateEntry> => [`its why names no card ${named}`, ({ why }) => !why.includes(named)])
}

/** A rule's case kept unrun while its build waits on a card: it joins the cases its lane runs once the rule ships. */
export type HeldCase<Case extends { readonly rule: string } = { readonly rule: string }> = {
  /** The card the rule's build waits on. */
  readonly heldBy: string
  readonly ruleCase: Case
}

/** A card a build waits on: a question the owner answers, `q-` and lower-case words joined by hyphens. */
const QUESTION_CARD = /^q-[\da-z]+(?:-[\da-z]+)*$/u

/**
 * `rule: what is wrong` for each held case whose rule the owner did not accept, that is held for no card, whose rule
 * ships or a later card dropped, or that is held for another card than the one its rule's build waits on.
 */
export function heldCasesOutOfPlace(heldCases: readonly HeldCase[], accepted: Readonly<Record<string, AcceptedRule>>, shippedIds: ReadonlySet<string>): string[] {
  const acceptedById = new Map(Object.entries(accepted))
  return heldCases.flatMap((heldCase) =>
    wrongsOfAHeldCase(heldCase, acceptedById.get(heldCase.ruleCase.rule), shippedIds).map((wrong) => `${heldCase.ruleCase.rule}: ${wrong}`),
  )
}

function wrongsOfAHeldCase(heldCase: HeldCase, acceptedRule: AcceptedRule | undefined, shippedIds: ReadonlySet<string>): string[] {
  const breaches: ReadonlyArray<Breach<HeldCase>> = [
    ['is held, but is no rule the owner accepted', () => acceptedRule === undefined],
    [`is held for "${heldCase.heldBy}", which is no card`, ({ heldBy }) => !QUESTION_CARD.test(heldBy)],
    [`ships, so its case runs rather than waiting on card ${heldCase.heldBy}`, ({ ruleCase }) => shippedIds.has(ruleCase.rule)],
  ]
  return [...breachesOf(heldCase, breaches), ...wrongsOfItsCard(heldCase, acceptedRule)]
}

/** A rule the owner did not accept has no card its build waits on, so its held case is named for that alone. */
function wrongsOfItsCard({ heldBy }: HeldCase, acceptedRule: AcceptedRule | undefined): string[] {
  if (acceptedRule === undefined) return []
  if ('droppedBy' in acceptedRule) return [`is held, but card ${acceptedRule.droppedBy} dropped its rule`]
  if (acceptedRule.heldBy === heldBy) return []
  const cardItsBuildWaitsOn = acceptedRule.heldBy === undefined ? 'no card' : `card ${acceptedRule.heldBy}`
  return [`is held for card ${heldBy}, but its build waits on ${cardItsBuildWaitsOn}`]
}
