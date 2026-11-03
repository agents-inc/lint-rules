import { fileURLToPath } from 'node:url'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { lookUpsWrittenOutIn } from './__tests__/look-ups-written-out.ts'
import { compareCodeUnits, filterEntries, foundOr, groupBy, mapValues, sharedKeys } from './collections.ts'

const SOURCE_DIR = fileURLToPath(new URL('.', import.meta.url))
const LENGTHS_BY_WORD: ReadonlyMap<string, number> = new Map([['three', 3]])
const NOTES_BY_WORD: ReadonlyMap<string, string | null> = new Map([['three', null]])
const MISS_MESSAGE = 'no length is recorded for "four"'
// Keyed by first letter: b first appears before a, and each of b and a recurs after the other has appeared.
const FRUITS: readonly string[] = ['banana', 'apple', 'cherry', 'blueberry', 'avocado', 'apricot']
const FRUITS_EACH_UNDER_A_LETTER_OF_ITS_OWN: readonly string[] = ['banana', 'apple', 'cherry']
// Keys out of code-unit order, so a result in the record's order is not one sorted by key.
const COUNTS_BY_FRUIT: Readonly<Record<string, number>> = { cherry: 3, apple: 1, banana: 2 }
const NOTES_BY_FRUIT: Readonly<Record<string, string | undefined>> = { cherry: 'stoned', apple: undefined, banana: 'peeled' }

function firstLetterOf(word: string): string {
  return word.slice(0, 1)
}

function isNoted(entry: readonly [fruit: string, note: string | undefined]): entry is readonly [string, string] {
  return entry[1] !== undefined
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

describe('mapValues', () => {
  it('gives each value mapped, under its own key, in the order the record gives', () => {
    expect(Object.entries(mapValues(COUNTS_BY_FRUIT, (count) => count * 10))).toStrictEqual([
      ['cherry', 30],
      ['apple', 10],
      ['banana', 20],
    ])
  })

  it('hands the mapping each key beside its value', () => {
    expect(Object.entries(mapValues(COUNTS_BY_FRUIT, (count, fruit) => `${fruit}:${String(count)}`))).toStrictEqual([
      ['cherry', 'cherry:3'],
      ['apple', 'apple:1'],
      ['banana', 'banana:2'],
    ])
  })
})

describe('filterEntries', () => {
  it('keeps the entries whose value the test passes, in the order the record gives, and drops the rest', () => {
    expect(Object.entries(filterEntries(COUNTS_BY_FRUIT, ([, count]) => count > 1))).toStrictEqual([
      ['cherry', 3],
      ['banana', 2],
    ])
  })

  it('keeps the entries whose key the test passes', () => {
    expect(Object.entries(filterEntries(COUNTS_BY_FRUIT, ([fruit]) => fruit !== 'cherry'))).toStrictEqual([
      ['apple', 1],
      ['banana', 2],
    ])
  })

  it('gives the values a type guard keeps, typed as it narrows them', () => {
    const noted = filterEntries(NOTES_BY_FRUIT, isNoted)

    expectTypeOf(noted).toEqualTypeOf<Record<string, string>>()
    expect(Object.entries(noted)).toStrictEqual([
      ['cherry', 'stoned'],
      ['banana', 'peeled'],
    ])
  })
})

describe('the source of rule-data, tests aside', () => {
  it('writes out no look-up that throws on a miss: each goes through foundOr, keeping its message', () => {
    expect(lookUpsWrittenOutIn(SOURCE_DIR)).toStrictEqual([])
  })
})
