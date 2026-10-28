import { describe, expect, it } from 'vitest'
import { laidOver } from './laid-over.ts'

// The factories and oracles join a config's pieces with it: a later piece's key winning is what each relies on.

type Settings = { readonly first?: string; readonly second?: string; readonly third?: string }

const UNDER: Settings = { first: 'under', second: 'under' }

describe('laidOver', () => {
  it("keeps every key the pieces give, a later piece's value replacing an earlier one's and the one under them", () => {
    expect(laidOver(UNDER, [{ second: 'earlier', third: 'earlier' }, { third: 'later' }])).toStrictEqual({ first: 'under', second: 'earlier', third: 'later' })
  })

  it('gives what is under them where there are no pieces', () => {
    expect(laidOver(UNDER, [])).toStrictEqual(UNDER)
  })
})
