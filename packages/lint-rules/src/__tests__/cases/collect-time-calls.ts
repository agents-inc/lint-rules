// Modules a program is made of: helpers a test file imports, and test files calling them as vitest collects
// the file or later.

export const HELPERS = `export function lookUp(id: string): string {
  if (id === '') throw new Error('no id')
  return id
}

export function lookUpThroughAnother(id: string): string {
  return lookUp(id)
}

export function caught(id: string): string {
  try {
    return lookUp(id)
  } catch {
    return ''
  }
}

export function rethrown(id: string): string {
  try {
    return lookUp(id)
  } catch (error) {
    throw new Error('no such id', { cause: error })
  }
}

export function cleanedUpByALookUp(id: string): string {
  try {
    return id
  } catch {
    return ''
  } finally {
    lookUp(id)
  }
}

export function makesALookUp(id: string): () => string {
  return () => lookUp(id)
}

export function countdown(from: number): number {
  return from === 0 ? 0 : countdown(from - 1)
}

export function throwsAtTheBottom(depth: number): number {
  if (depth > 0) return stepsDown(depth)
  throw new Error('at the bottom')
}

export function stepsDown(depth: number): number {
  return throwsAtTheBottom(depth - 1)
}

export function isEven(n: number): boolean {
  return n === 0 ? true : isOdd(n - 1)
}

export function isOdd(n: number): boolean {
  return n === 0 ? false : isEven(n - 1)
}

export function startsTheLoop(n: number): number {
  goesRound(n)
  throw new Error('after the loop')
}

export function goesRound(n: number): number {
  return comesBack(n)
}

export function comesBack(n: number): number {
  return n > 0 ? startsTheLoop(n - 1) : n
}

export function throwsAfterItsPartner(n: number): number {
  callsItselfAndBack(n)
  throw new Error('after the partner')
}

export function callsItselfAndBack(n: number): number {
  return n > 0 ? callsItselfAndBack(n - 1) + throwsAfterItsPartner(n - 1) : n
}

export function throwsAfterBothReads(n: number): number {
  entersTheInnerLoop(n)
  reachesTheInnerLoop(n)
  throw new Error('after both reads')
}

export function entersTheInnerLoop(n: number): number {
  return n > 0 ? innerLoopEnd(n - 1) + throwsAfterBothReads(n - 1) : n
}

export function innerLoopEnd(n: number): number {
  return n > 0 ? entersTheInnerLoop(n - 1) : n
}

export function reachesTheInnerLoop(n: number): number {
  return innerLoopEnd(n)
}
`

export const THROWING_CALLS_AS_THE_FILE_IS_COLLECTED = `import { lookUp, lookUpThroughAnother } from './helpers.ts'

const AT_THE_TOP = lookUp('a')

describe('a suite', () => {
  const inTheBody = lookUpThroughAnother('b')

  it.each([{ id: lookUp('c') }])('a case per row', ({ id }) => {})

  describe.each([lookUp('d')])('a suite per row', () => {})
})

const HANDED_TO_MAP = ['e'].map(lookUp)
const IN_A_CALLBACK_MAP_CALLS = ['f'].map((id) => lookUp(id))
`

// A module outside the project, as an installed package's source is.
export const LIBRARY_ELSEWHERE = `export function lookUpElsewhere(id: string): string {
  if (id === '') throw new Error('no id')
  return id
}
`

export const A_THROWING_CALL_OUTSIDE_OUR_FILES = `import { lookUpElsewhere } from '../elsewhere/library.ts'

const FROM_A_LIBRARY = lookUpElsewhere('a')
`

export const THROWS_A_CATCH_OR_A_FINALLY_LETS_OUT =`import { cleanedUpByALookUp, rethrown } from './helpers.ts'

const RETHROWN = rethrown('a')
const CLEANED_UP = cleanedUpByALookUp('b')
`

export const A_THROWING_FUNCTION_HANDED_OVER_THROUGH_A_NAMESPACE = `import * as helpers from './helpers.ts'

const LOOKED_UP = ['a'].map(helpers.lookUp)
`

export const CALLS_THAT_RUN_LATER_OR_CANNOT_THROW =`import { caught, countdown, lookUp, makesALookUp } from './helpers.ts'

const CAUGHT = caught('a')
const MADE = makesALookUp('b')
const LATER = () => lookUp('c')
const COUNTED = countdown(3)

describe('a suite', () => {
  beforeAll(() => {
    lookUp('d')
  })

  it('a case', () => {
    lookUp('e')
  })

  it.each([{ id: 'f' }])('a case per row', ({ id }) => {
    lookUp(id)
  })
})
`

// Two functions calling each other, one of which throws, read in each order.
export const THE_PARTNER_OF_A_THROWING_FUNCTION_ALONE = `import { stepsDown } from './helpers.ts'

const STEPPED = stepsDown(1)
`

export const A_THROWING_FUNCTION_THEN_THE_PARTNER_IT_CALLS = `import { stepsDown, throwsAtTheBottom } from './helpers.ts'

const AT_THE_BOTTOM = throwsAtTheBottom(1)
const STEPPED = stepsDown(1)
`

export const THE_PARTNER_THEN_THE_THROWING_FUNCTION_IT_CALLS = `import { stepsDown, throwsAtTheBottom } from './helpers.ts'

const STEPPED = stepsDown(1)
const AT_THE_BOTTOM = throwsAtTheBottom(1)
`

export const TWO_FUNCTIONS_CALLING_EACH_OTHER_NEITHER_THROWING = `import { isEven, isOdd } from './helpers.ts'

const EVEN = isEven(2)
const ODD = isOdd(3)
`

// Functions that call back into a caller, each read first from the one that throws, then called again.
export const A_LOOP_OF_THREE_FROM_ITS_THROWING_MEMBER_THEN_ANOTHER = `import { goesRound, startsTheLoop } from './helpers.ts'

const STARTED = startsTheLoop(1)
const ROUND = goesRound(1)
`

export const A_FUNCTION_CALLING_ITSELF_AND_ITS_THROWING_CALLER = `import { callsItselfAndBack, throwsAfterItsPartner } from './helpers.ts'

const THROWN = throwsAfterItsPartner(1)
const PARTNER = callsItselfAndBack(1)
`

export const AN_INNER_LOOP_REACHED_AGAIN_UNDER_ITS_THROWING_CALLER = `import { reachesTheInnerLoop, throwsAfterBothReads } from './helpers.ts'

const THROWN = throwsAfterBothReads(1)
const REACHED = reachesTheInnerLoop(1)
`

// Each level calls the next twice, so a finder that reads a helper once per call reads the bottom one
// 2 ** 6 times.
export const CHAIN_OF_HELPERS_EACH_CALLING_THE_NEXT_TWICE = `export function level0(): number { return level1() + level1() }
export function level1(): number { return level2() + level2() }
export function level2(): number { return level3() + level3() }
export function level3(): number { return level4() + level4() }
export function level4(): number { return level5() + level5() }
export function level5(): number { return level6() + level6() }
export function level6(): number { return 1 }

export function throwingLevel0(): number { return throwingLevel1() + throwingLevel1() }
export function throwingLevel1(): number { return throwingLevel2() + throwingLevel2() }
export function throwingLevel2(): number { return throwingLevel3() + throwingLevel3() }
export function throwingLevel3(): number { return throwingLevel4() + throwingLevel4() }
export function throwingLevel4(): number { return throwingLevel5() + throwingLevel5() }
export function throwingLevel5(): number { return throwingLevel6() + throwingLevel6() }
export function throwingLevel6(): number { throw new Error('at the bottom') }

export function loopingLevel0(): number { return loopingLevel1() + loopingLevel1() }
export function loopingLevel1(): number { return loopingLevel2() + loopingLevel2() }
export function loopingLevel2(): number { return loopingLevel3() + loopingLevel3() }
export function loopingLevel3(): number { return loopingLevel4() + loopingLevel4() }
export function loopingLevel4(): number { return loopingLevel5() + loopingLevel5() }
export function loopingLevel5(): number { return loopingLevel6() + loopingLevel6() }
export function loopingLevel6(): number { return loopingLevel0() }

export function throwsAfterTheChain(): number {
  level0()
  throw new Error('after the chain')
}

export function throwsAfterTheLoop(): number {
  loopingLevel0()
  throw new Error('after the loop')
}
`

// One call in the test file, and two in each of the six levels above the bottom.
export const CALLS_WRITTEN_DOWN_THE_CHAIN = 1 + 6 * 2

// As down the chain, and one more from the bottom back to the top.
export const CALLS_WRITTEN_ROUND_THE_LOOP = CALLS_WRITTEN_DOWN_THE_CHAIN + 1

// Each chain test file imports one module, chain.ts, and following an import may ask once whether its module is ours.
export const IMPORTS_WRITTEN_IN_A_CHAIN_TEST_FILE = 1

export const A_CALL_DOWN_A_CHAIN_OF_SHARED_HELPERS_NONE_THROWING = `import { level0 } from './chain.ts'

const TOTAL = level0()
`

export const A_CALL_DOWN_A_CHAIN_OF_SHARED_HELPERS_ENDING_IN_A_THROW = `import { throwingLevel0 } from './chain.ts'

const TOTAL = throwingLevel0()
`

export const A_CALL_ROUND_A_LOOP_OF_SHARED_HELPERS = `import { loopingLevel0 } from './chain.ts'

const TOTAL = loopingLevel0()
`

// The chain and the loop are read first under a caller that throws after them, then called alone.
export const SHARED_HELPERS_CALLED_AGAIN_AFTER_A_THROWING_CALLER_READ_THEM = `import { level0, loopingLevel3, throwsAfterTheChain, throwsAfterTheLoop } from './chain.ts'

const AFTER_THE_CHAIN = throwsAfterTheChain()
const CHAIN = level0()
const AFTER_THE_LOOP = throwsAfterTheLoop()
const LOOP = loopingLevel3()
`

// Helper modules in __tests__/, as the repo's are. Vitest runs a helper's top level as it collects a test file that
// loads it, by an import of the test file's own or of another helper's.
export const A_HELPER_LOOKING_UP_AT_ITS_TOP = `import { lookUp } from '../helpers.ts'

export type LookedUp = string

export const LOOKED_UP_AT_THE_TOP: LookedUp = lookUp('a')
`

export const A_HELPER_DECLARING_AND_CALLING_NOTHING_THAT_THROWS = `import { caught, lookUp } from '../helpers.ts'

export function lookUpLater(id: string): string {
  return lookUp(id)
}

export const LOOK_UP_LATER = (): string => lookUp('b')

export const CAUGHT_AT_THE_TOP = caught('c')
`

export const A_HELPER_IMPORTING_ONE_THAT_LOOKS_UP = `import { LOOKED_UP_FURTHER_DOWN } from './looked-up-further-down.ts'

export const PASSED_ON = LOOKED_UP_FURTHER_DOWN
`

export const A_HELPER_LOOKING_UP_FURTHER_DOWN = `import { lookUp } from '../helpers.ts'

export const LOOKED_UP_FURTHER_DOWN = lookUp('d')
`

export const A_HELPER_IMPORTING_ONE_THAT_ONLY_DECLARES = `import { lookUpLater } from './declares-only.ts'

export const LOOK_UP_THROUGH = lookUpLater
`

export const A_HELPER_CALLING_A_LIBRARY_AT_ITS_TOP = `import { lookUpElsewhere } from '../../elsewhere/library.ts'

export const FROM_A_LIBRARY = lookUpElsewhere('e')
`

export const A_HELPER_IMPORTING_THE_ONE_THAT_LOOKS_UP = `import { LOOKED_UP_AT_THE_TOP } from './looked-up-at-the-top.ts'

export const LOOKED_UP_AGAIN = LOOKED_UP_AT_THE_TOP
`

export const A_HELPER_STARTING_AN_IMPORT_CYCLE = `import { lookUp } from '../helpers.ts'
import { ENDED } from './cycle-end.ts'

export const STARTED = lookUp('f')

export function endedOf(): string {
  return ENDED
}
`

export const A_HELPER_ENDING_AN_IMPORT_CYCLE = `import { STARTED } from './cycle-start.ts'

export const ENDED = 'g'

export function startedOf(): string {
  return STARTED
}
`

// Test files loading those helpers.
export const A_TEST_FILE_LOADING_A_HELPER_THAT_LOOKS_UP_AT_ITS_TOP = `import { LOOKED_UP_AT_THE_TOP } from './__tests__/looked-up-at-the-top.ts'

it('a case', () => LOOKED_UP_AT_THE_TOP)
`

export const A_TEST_FILE_LOADING_A_HELPER_THAT_ONLY_DECLARES = `import { lookUpLater } from './__tests__/declares-only.ts'

it('a case', () => lookUpLater('h'))
`

export const A_TEST_FILE_LOADING_A_HELPER_THROUGH_ANOTHER = `import { PASSED_ON } from './__tests__/imports-another.ts'

it('a case', () => PASSED_ON)
`

export const A_TEST_FILE_LOADING_A_HELPER_THAT_ONLY_DECLARES_THROUGH_ANOTHER = `import { LOOK_UP_THROUGH } from './__tests__/imports-one-that-only-declares.ts'

it('a case', () => LOOK_UP_THROUGH('i'))
`

export const A_TEST_FILE_LOADING_A_HELPER_THAT_CALLS_A_LIBRARY_AT_ITS_TOP = `import { FROM_A_LIBRARY } from './__tests__/library-call-at-the-top.ts'

it('a case', () => FROM_A_LIBRARY)
`

// A type-only import is erased before the file runs, so the helper is never loaded.
export const A_TEST_FILE_IMPORTING_ONLY_A_TYPE_FROM_A_HELPER_THAT_LOOKS_UP = `import type { LookedUp } from './__tests__/looked-up-at-the-top.ts'

const TYPED: LookedUp = 'j'
`

export const A_TEST_FILE_LOADING_ONE_HELPER_DIRECTLY_AND_THROUGH_ANOTHER = `import { LOOKED_UP_AT_THE_TOP } from './__tests__/looked-up-at-the-top.ts'
import { LOOKED_UP_AGAIN } from './__tests__/imports-the-looked-up-one-again.ts'

it('a case', () => [LOOKED_UP_AT_THE_TOP, LOOKED_UP_AGAIN])
`

export const A_TEST_FILE_LOADING_HELPERS_THAT_IMPORT_EACH_OTHER = `import { endedOf } from './__tests__/cycle-start.ts'

it('a case', () => endedOf())
`

export const A_TEST_FILE_LOOKING_UP_WITH_WHAT_A_HELPER_LOOKED_UP_AT_ITS_TOP = `import { lookUp } from './helpers.ts'
import { LOOKED_UP_AT_THE_TOP } from './__tests__/looked-up-at-the-top.ts'

const LOOKED_UP_HERE = lookUp(LOOKED_UP_AT_THE_TOP)
`
