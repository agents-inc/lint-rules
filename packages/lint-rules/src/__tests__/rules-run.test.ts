import { describe, expect, it } from 'vitest'
import { buildStats, buildTimePass, buildTimePassWithNoRules } from './factories/lint-stats-factories.ts'
import { rulesRunIn } from './rules-run.ts'

const CURLY = 'curly'
const EQEQEQ = 'eqeqeq'
const NO_VAR = 'no-var'

describe('rulesRunIn', () => {
  it('lists each rule any pass ran once, by name, the first of them included, whatever order the passes ran them in', () => {
    const stats = buildStats([buildTimePass([NO_VAR, EQEQEQ]), buildTimePassWithNoRules(), buildTimePass([EQEQEQ, CURLY])])

    expect(rulesRunIn(stats)).toStrictEqual([CURLY, EQEQEQ, NO_VAR])
  })

  it('lists none where no pass ran a rule', () => {
    expect(rulesRunIn(buildStats([buildTimePassWithNoRules()]))).toStrictEqual([])
  })
})
