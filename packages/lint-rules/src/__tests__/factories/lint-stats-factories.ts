import type { Linter } from 'eslint'

const NO_TIME = 0
const NO_FIX_PASS = 0

/** A pass of ESLint over a file that ran each rule given, timed at nothing. */
export function buildTimePass(ruleIds: readonly string[]): Linter.TimePass {
  return { rules: Object.fromEntries(ruleIds.map((ruleId) => [ruleId, { total: NO_TIME }])), fix: { total: NO_TIME }, total: NO_TIME }
}

/** A pass whose `rules` ESLint left out, as its types allow. */
export function buildTimePassWithNoRules(): Linter.TimePass {
  return { fix: { total: NO_TIME }, total: NO_TIME }
}

export function buildStats(passes: readonly Linter.TimePass[]): Linter.Stats {
  return { fixPasses: NO_FIX_PASS, times: { passes: [...passes] } }
}
