import { describe, expect, it } from 'vitest'
import { buildDrawnTerms, seededDraws } from './files-condition-factories.ts'

// The draws pick the conditions the files-condition specs compare the two readings on: a sequence that changed would
// change which conditions they cover, with every spec still passing. The values are those the draws give today, written
// out; double arithmetic rounds the product, so they part from glibc's own sequence from the second draw on.

const SEED = 1
const BOUND = 1000
const GLOBS = ['a/**', 'b/**', 'c/**']

describe('seededDraws', () => {
  it('draws, for a seed, the whole numbers below the bound written out here, in order', () => {
    const draw = seededDraws(SEED)

    expect(Array.from({ length: 6 }, () => draw(BOUND))).toStrictEqual([590, 600, 792, 912, 56, 584])
  })

  it('keeps each sequence its own: two made from one seed draw alike, side by side', () => {
    const first = seededDraws(SEED)
    const second = seededDraws(SEED)

    expect([first(BOUND), second(BOUND), first(BOUND), second(BOUND)]).toStrictEqual([590, 590, 600, 600])
  })
})

describe('buildDrawnTerms', () => {
  it('draws, for a seed, the terms written out here: a glob of `all` negated now and then', () => {
    expect(buildDrawnTerms(seededDraws(SEED), GLOBS)).toStrictEqual([
      { all: ['!c/**'], none: ['b/**'] },
      { all: ['b/**', '!c/**'], none: ['a/**'] },
      { all: ['c/**'], none: [] },
    ])
  })
})
