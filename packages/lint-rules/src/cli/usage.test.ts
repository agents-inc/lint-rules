import { describe, expect, it } from 'vitest'
import { isBelowTheNodeFloor } from './usage.ts'

// `process.versions.node` has no leading `v`.

const THE_FLOOR = '22.18.0'
const A_LATER_MINOR = '22.23.2'
const A_LATER_MAJOR = '24.1.0'
const THE_MINOR_BELOW = '22.17.1'
const THE_MAJOR_BELOW = '21.99.0'

describe('the Node floor', () => {
  it('lets 22.18 itself run, and a later minor and a later major whose minor is below 18', () => {
    expect([THE_FLOOR, A_LATER_MINOR, A_LATER_MAJOR].map((version) => isBelowTheNodeFloor(version))).toStrictEqual([false, false, false])
  })

  it('refuses the minor below the floor, and a major below it whose minor is above 18', () => {
    expect([THE_MINOR_BELOW, THE_MAJOR_BELOW].map((version) => isBelowTheNodeFloor(version))).toStrictEqual([true, true])
  })
})
