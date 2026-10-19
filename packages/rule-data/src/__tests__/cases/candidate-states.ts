// The states data/rule-candidates.json gives a rule rules.json does not ship.

/** A rule we may still ship. */
export const CANDIDATE_STATUSES: readonly string[] = ['considering', 'recommended', 'parked', 'needs-owner']

/** A rule decided against, each with the card or decision that dropped it, or one nobody has looked at. */
export const UNSHIPPED_STATUSES: readonly string[] = ['dropped', 'not-reviewed']

/** The reason every not-reviewed entry gives, as the owner's chosen option worded it. */
export const NOT_REVIEWED_WHY = 'not reviewed yet'
