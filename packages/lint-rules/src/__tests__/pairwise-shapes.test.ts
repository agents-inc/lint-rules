import { describe, expect, it } from 'vitest'
import { buildDimension } from './factories/shape-factories.ts'
import { coverageOf, pairsMetInNoShape, pairwiseShapes } from './pairwise-shapes.ts'

// The shapes the oxlint merge's differential test runs: every two values of two dimensions meet in
// one of them, so the run stays small while no pair goes untried.

const SIZE = buildDimension('size', ['small', 'large'])
const COLOUR = buildDimension('colour', ['red', 'blue'])
const SHAPE = buildDimension('shape', ['round', 'square', 'flat'])
const MATERIAL = buildDimension('material', ['wood', 'steel'])

describe('pairwiseShapes', () => {
  it('meets every two values of two dimensions in some shape', () => {
    const dimensions = [SHAPE, SIZE, COLOUR, MATERIAL]

    expect(pairsMetInNoShape(dimensions, pairwiseShapes(dimensions))).toStrictEqual([])
  })

  it('gives each combination of two dimensions once, the first value of each first', () => {
    expect(pairwiseShapes([SIZE, COLOUR])).toStrictEqual([
      ['small', 'red'],
      ['small', 'blue'],
      ['large', 'red'],
      ['large', 'blue'],
    ])
  })

  // 3·2 is the fewest shapes that can meet each shape with each size; each shape meets 4 triples.
  it('runs fewer shapes than every combination once there are three dimensions, and meets every pair', () => {
    const dimensions = [SHAPE, SIZE, COLOUR, MATERIAL]

    expect(coverageOf(dimensions, pairwiseShapes(dimensions))).toStrictEqual({
      shapes: 6,
      combinations: 24,
      pairsMet: 30,
      pairs: 30,
      triplesMet: 24,
      triples: 44,
    })
  })

  it("starts with each seed, the seed's values in one shape", () => {
    const [first] = pairwiseShapes([SHAPE, SIZE, COLOUR], [['flat', 'blue']])

    expect(first).toStrictEqual(['flat', 'small', 'blue'])
  })

  it('refuses a seed giving two values of one dimension', () => {
    expect(() => pairwiseShapes([SIZE, COLOUR], [['small', 'large']])).toThrowError(/two values of one dimension: size, size/u)
  })

  it('refuses a seed value no dimension has', () => {
    expect(() => pairwiseShapes([SIZE, COLOUR], [['green']])).toThrowError(/exactly one dimension, and is one of 0/u)
  })

  it('refuses a seed value two dimensions share, as it cannot tell which is meant', () => {
    const tint = buildDimension('tint', ['red', 'pale'])

    expect(() => pairwiseShapes([COLOUR, tint], [['red']])).toThrowError(/exactly one dimension, and is one of 2/u)
  })
})

describe('pairsMetInNoShape', () => {
  it('names each pair of values the shapes never meet', () => {
    expect(pairsMetInNoShape([SIZE, COLOUR], [['small', 'red']])).toStrictEqual([
      ['small', 'blue'],
      ['large', 'red'],
      ['large', 'blue'],
    ])
  })

  it('names none where the shapes meet every pair', () => {
    const shapes = [
      ['small', 'red'],
      ['small', 'blue'],
      ['large', 'red'],
      ['large', 'blue'],
    ]

    expect(pairsMetInNoShape([SIZE, COLOUR], shapes)).toStrictEqual([])
  })
})
