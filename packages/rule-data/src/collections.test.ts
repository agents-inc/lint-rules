import { fileURLToPath } from 'node:url'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { lookUpsWrittenOutIn } from './__tests__/look-ups-written-out.ts'
import { foundOr } from './collections.ts'

const SOURCE_DIR = fileURLToPath(new URL('.', import.meta.url))
const LENGTHS_BY_WORD: ReadonlyMap<string, number> = new Map([['three', 3]])
const NOTES_BY_WORD: ReadonlyMap<string, string | null> = new Map([['three', null]])
const MISS_MESSAGE = 'no length is recorded for "four"'

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
    expect(() => foundOr(LENGTHS_BY_WORD.get('four'), MISS_MESSAGE)).toThrowError(new Error(MISS_MESSAGE))
  })
})

describe('the source of rule-data, tests aside', () => {
  it('writes out no look-up that throws on a miss: each goes through foundOr, keeping its message', () => {
    expect(lookUpsWrittenOutIn(SOURCE_DIR)).toStrictEqual([])
  })
})
