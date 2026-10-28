import { fileURLToPath } from 'node:url'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { lookUpsWrittenOutIn } from './__tests__/look-ups-written-out.ts'
import { compareCodeUnits, foundOr, groupBy, sharedKeys } from './collections.ts'

const SOURCE_DIR = fileURLToPath(new URL('.', import.meta.url))
const LENGTHS_BY_WORD: ReadonlyMap<string, number> = new Map([['three', 3]])
const NOTES_BY_WORD: ReadonlyMap<string, string | null> = new Map([['three', null]])
const MISS_MESSAGE = 'no length is recorded for "four"'
// Keyed by first letter: b first appears before a, and each of b and a recurs after the other has appeared.
const FRUITS: readonly string[] = ['banana', 'apple', 'cherry', 'blueberry', 'avocado', 'apricot']
const FRUITS_EACH_UNDER_A_LETTER_OF_ITS_OWN: readonly string[] = ['banana', 'apple', 'cherry']

function firstLetterOf(word: string): string {
  return word.slice(0, 1)
}

describe('foundOr', () => {
  it('gives back the value looked up, typed without undefined', () => {
    const found = foundOr(LENGTHS_BY_WORD.get('three'), MISS_MESSAGE)

    expectTypeOf(found).toEqualTypeOf<number>()
    expect(found).toBe(3)
  })

  it('gives back null as found, typed with null: only undefined is a miss', () => {
    const found = foundOr(NOTES_BY_WORD.get('three'), MISS_MESSAGE)

    expectTypeOf(found).toEqualTypeOf<string | null>()
    expect(found).toBeNull()
  })

  it('gives back 0, the empty string and false as found', () => {
    expect([foundOr(0, MISS_MESSAGE), foundOr('', MISS_MESSAGE), foundOr(false, MISS_MESSAGE)]).toStrictEqual([0, '', false])
  })

  it('throws an Error with the message given where the look-up found nothing', () => {
    expect(() => foundOr(LENGTHS_BY_WORD.get('four'), MISS_MESSAGE)).toThrow(new Error(MISS_MESSAGE))
  })
})

describe('compareCodeUnits', () => {
  it('sorts by code unit, every upper-case letter before every lower-case one, unlike localeCompare', () => {
    expect(['b', 'a', 'B'].toSorted(compareCodeUnits)).toStrictEqual(['B', 'a', 'b'])
  })

  it('answers 0 for equal strings, neither before the other', () => {
    expect(compareCodeUnits('react', 'react')).toBe(0)
  })

  it('answers -1 where the first sorts before the second, and 1 where after', () => {
    expect([compareCodeUnits('a', 'b'), compareCodeUnits('b', 'a')]).toStrictEqual([-1, 1])
  })
})

describe('groupBy', () => {
  it('gives each key once, in the order it first appears, with its items in the order given', () => {
    expect(groupBy(FRUITS, firstLetterOf).entries().toArray()).toStrictEqual([
      ['b', ['banana', 'blueberry']],
      ['a', ['apple', 'avocado', 'apricot']],
      ['c', ['cherry']],
    ])
  })

  it('gives no group for no items', () => {
    expect(groupBy([], firstLetterOf).entries().toArray()).toStrictEqual([])
  })
})

describe('sharedKeys', () => {
  it('gives each key two or more items share, with those items, in the order the key first appears', () => {
    expect(sharedKeys(FRUITS, firstLetterOf)).toStrictEqual([
      ['b', ['banana', 'blueberry']],
      ['a', ['apple', 'avocado', 'apricot']],
    ])
  })

  it('gives none where each item has a key of its own', () => {
    expect(sharedKeys(FRUITS_EACH_UNDER_A_LETTER_OF_ITS_OWN, firstLetterOf)).toStrictEqual([])
  })
})

describe('the source of rule-data, tests aside', () => {
  it('writes out no look-up that throws on a miss: each goes through foundOr, keeping its message', () => {
    expect(lookUpsWrittenOutIn(SOURCE_DIR)).toStrictEqual([])
  })
})
