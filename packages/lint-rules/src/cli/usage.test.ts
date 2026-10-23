import { describe, expect, it } from 'vitest'
import { belowTheNodeFloorLine, commandOf, isBelowTheNodeFloor } from './usage.ts'

// `process.versions.node` has no leading `v`.

const THE_FLOOR = '22.18.0'
const A_LATER_MINOR = '22.23.2'
const A_LATER_MAJOR = '24.1.0'
const THE_MINOR_BELOW = '22.17.1'
const THE_MAJOR_BELOW = '21.99.0'
const NOT_A_VERSION = 'unknown'

const CALLS_NAMING_A_COMMAND = [['check'], ['init']]
const WRONG_CALLS = [[], ['foo'], ['--help'], ['check', '--help'], ['init', 'x']]

describe('the command a call names', () => {
  it('is check or init, given alone', () => {
    expect(CALLS_NAMING_A_COMMAND.map((args) => commandOf(args))).toStrictEqual(['check', 'init'])
  })

  it('is none for no command, an unknown one, --help, or a known one with more after it', () => {
    expect(WRONG_CALLS.map((args) => commandOf(args))).toStrictEqual([null, null, null, null, null])
  })
})

describe('the line printed below the Node floor', () => {
  it('names the command, the floor and the Node that ran it', () => {
    expect(belowTheNodeFloorLine('init', THE_MINOR_BELOW)).toBe('init: could not run: Node 22.18 or later is needed; this is Node 22.17.1.\n')
  })
})

describe('the Node floor', () => {
  it('lets 22.18 itself run, and a later minor and a later major whose minor is below 18', () => {
    expect([THE_FLOOR, A_LATER_MINOR, A_LATER_MAJOR].map((version) => isBelowTheNodeFloor(version))).toStrictEqual([false, false, false])
  })

  it('refuses the minor below the floor, and a major below it whose minor is above 18', () => {
    expect([THE_MINOR_BELOW, THE_MAJOR_BELOW].map((version) => isBelowTheNodeFloor(version))).toStrictEqual([true, true])
  })

  it('refuses a version it cannot read', () => {
    expect(isBelowTheNodeFloor(NOT_A_VERSION)).toBe(true)
  })
})
