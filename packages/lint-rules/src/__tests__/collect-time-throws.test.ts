import { foundOr } from '@workspace/rule-data/collections'
import { describe, expect, it, vi } from 'vitest'
import {
  A_CALL_DOWN_A_CHAIN_OF_SHARED_HELPERS_ENDING_IN_A_THROW,
  A_CALL_DOWN_A_CHAIN_OF_SHARED_HELPERS_NONE_THROWING,
  A_CALL_ROUND_A_LOOP_OF_SHARED_HELPERS,
  A_FUNCTION_CALLING_ITSELF_AND_ITS_THROWING_CALLER,
  A_HELPER_CALLING_A_LIBRARY_AT_ITS_TOP,
  A_HELPER_DECLARING_AND_CALLING_NOTHING_THAT_THROWS,
  A_HELPER_ENDING_AN_IMPORT_CYCLE,
  A_HELPER_IMPORTING_ONE_THAT_LOOKS_UP,
  A_HELPER_IMPORTING_ONE_THAT_ONLY_DECLARES,
  A_HELPER_IMPORTING_THE_ONE_THAT_LOOKS_UP,
  A_HELPER_LOOKING_UP_AT_ITS_TOP,
  A_HELPER_LOOKING_UP_FURTHER_DOWN,
  A_HELPER_STARTING_AN_IMPORT_CYCLE,
  A_LOOP_OF_THREE_FROM_ITS_THROWING_MEMBER_THEN_ANOTHER,
  A_TEST_FILE_IMPORTING_ONLY_A_TYPE_FROM_A_HELPER_THAT_LOOKS_UP,
  A_TEST_FILE_LOADING_A_HELPER_THAT_CALLS_A_LIBRARY_AT_ITS_TOP,
  A_TEST_FILE_LOADING_A_HELPER_THAT_LOOKS_UP_AT_ITS_TOP,
  A_TEST_FILE_LOADING_A_HELPER_THAT_ONLY_DECLARES,
  A_TEST_FILE_LOADING_A_HELPER_THAT_ONLY_DECLARES_THROUGH_ANOTHER,
  A_TEST_FILE_LOADING_A_HELPER_THROUGH_ANOTHER,
  A_TEST_FILE_LOADING_HELPERS_THAT_IMPORT_EACH_OTHER,
  A_TEST_FILE_LOADING_ONE_HELPER_DIRECTLY_AND_THROUGH_ANOTHER,
  A_TEST_FILE_LOOKING_UP_WITH_WHAT_A_HELPER_LOOKED_UP_AT_ITS_TOP,
  A_THROWING_CALL_OUTSIDE_OUR_FILES,
  A_THROWING_FUNCTION_HANDED_OVER_THROUGH_A_NAMESPACE,
  A_THROWING_FUNCTION_THEN_THE_PARTNER_IT_CALLS,
  AN_INNER_LOOP_REACHED_AGAIN_UNDER_ITS_THROWING_CALLER,
  CALLS_THAT_RUN_LATER_OR_CANNOT_THROW,
  CALLS_WRITTEN_DOWN_THE_CHAIN,
  CALLS_WRITTEN_ROUND_THE_LOOP,
  CHAIN_OF_HELPERS_EACH_CALLING_THE_NEXT_TWICE,
  HELPERS,
  IMPORTS_WRITTEN_IN_A_CHAIN_TEST_FILE,
  LIBRARY_ELSEWHERE,
  SHARED_HELPERS_CALLED_AGAIN_AFTER_A_THROWING_CALLER_READ_THEM,
  THE_PARTNER_OF_A_THROWING_FUNCTION_ALONE,
  THE_PARTNER_THEN_THE_THROWING_FUNCTION_IT_CALLS,
  THROWING_CALLS_AS_THE_FILE_IS_COLLECTED,
  THROWS_A_CATCH_OR_A_FINALLY_LETS_OUT,
  TWO_FUNCTIONS_CALLING_EACH_OTHER_NEITHER_THROWING,
} from './cases/collect-time-calls.ts'
import { type CollectTimeThrow, collectTimeThrowsIn } from './collect-time-throws.ts'
import { programOfFiles } from './factories/typescript-program-factories.ts'

const PROJECT = '/project/'
const TEST_FILE = `${PROJECT}a.test.ts`
const LIBRARY_FILE = '/elsewhere/library.ts'
const HELPER_FOLDER = `${PROJECT}__tests__/`
const LOOKED_UP_AT_THE_TOP_FILE = `${HELPER_FOLDER}looked-up-at-the-top.ts`
const LOOKED_UP_FURTHER_DOWN_FILE = `${HELPER_FOLDER}looked-up-further-down.ts`
const CYCLE_START_FILE = `${HELPER_FOLDER}cycle-start.ts`

function isOurs(file: string): boolean {
  return file.startsWith(PROJECT)
}

function collectTimeThrowsOfTestFile(text: string, isOursAsked: (file: string) => boolean = isOurs): CollectTimeThrow[] {
  const program = programOfFiles({
    [`${PROJECT}helpers.ts`]: HELPERS,
    [`${PROJECT}chain.ts`]: CHAIN_OF_HELPERS_EACH_CALLING_THE_NEXT_TWICE,
    [LIBRARY_FILE]: LIBRARY_ELSEWHERE,
    [LOOKED_UP_AT_THE_TOP_FILE]: A_HELPER_LOOKING_UP_AT_ITS_TOP,
    [`${HELPER_FOLDER}declares-only.ts`]: A_HELPER_DECLARING_AND_CALLING_NOTHING_THAT_THROWS,
    [`${HELPER_FOLDER}imports-another.ts`]: A_HELPER_IMPORTING_ONE_THAT_LOOKS_UP,
    [LOOKED_UP_FURTHER_DOWN_FILE]: A_HELPER_LOOKING_UP_FURTHER_DOWN,
    [`${HELPER_FOLDER}imports-one-that-only-declares.ts`]: A_HELPER_IMPORTING_ONE_THAT_ONLY_DECLARES,
    [`${HELPER_FOLDER}library-call-at-the-top.ts`]: A_HELPER_CALLING_A_LIBRARY_AT_ITS_TOP,
    [`${HELPER_FOLDER}imports-the-looked-up-one-again.ts`]: A_HELPER_IMPORTING_THE_ONE_THAT_LOOKS_UP,
    [CYCLE_START_FILE]: A_HELPER_STARTING_AN_IMPORT_CYCLE,
    [`${HELPER_FOLDER}cycle-end.ts`]: A_HELPER_ENDING_AN_IMPORT_CYCLE,
    [TEST_FILE]: text,
  })
  const sourceFile = foundOr(program.getSourceFile(TEST_FILE), `the program holds no ${TEST_FILE}`)
  return collectTimeThrowsIn(sourceFile, program.getTypeChecker(), isOursAsked)
}

describe('collectTimeThrowsIn', () => {
  it('finds each call that can throw at the top level, in a describe body and in an .each table, through a helper and a map', () => {
    expect(collectTimeThrowsOfTestFile(THROWING_CALLS_AS_THE_FILE_IS_COLLECTED)).toStrictEqual([
      { calls: 'lookUp', where: 'top level' },
      { calls: 'lookUpThroughAnother', where: 'describe body' },
      { calls: 'lookUp', where: '.each table' },
      { calls: 'lookUp', where: '.each table' },
      { calls: 'lookUp', where: 'top level' },
      { calls: 'lookUp', where: 'top level' },
    ])
  })

  it('finds a call whose catch throws again, and one whose finally throws', () => {
    expect(collectTimeThrowsOfTestFile(THROWS_A_CATCH_OR_A_FINALLY_LETS_OUT)).toStrictEqual([
      { calls: 'rethrown', where: 'top level' },
      { calls: 'cleanedUpByALookUp', where: 'top level' },
    ])
  })

  it('finds a throwing function handed to a map through a namespace import', () => {
    expect(collectTimeThrowsOfTestFile(A_THROWING_FUNCTION_HANDED_OVER_THROUGH_A_NAMESPACE)).toStrictEqual([
      { calls: 'helpers.lookUp', where: 'top level' },
    ])
  })

  it('finds none in a hook, a test or a function made for later, nor a call whose throw a catch takes, nor one calling itself that cannot throw', () => {
    expect(collectTimeThrowsOfTestFile(CALLS_THAT_RUN_LATER_OR_CANNOT_THROW)).toStrictEqual([])
  })

  it('finds none in a function outside our files, however it throws', () => {
    expect(collectTimeThrowsOfTestFile(A_THROWING_CALL_OUTSIDE_OUR_FILES)).toStrictEqual([])
  })
})

describe('collectTimeThrowsIn, on two functions that call each other', () => {
  it.each<{ readonly order: string; readonly text: string; readonly found: readonly CollectTimeThrow[] }>([
    { order: 'the partner alone', text: THE_PARTNER_OF_A_THROWING_FUNCTION_ALONE, found: [{ calls: 'stepsDown', where: 'top level' }] },
    {
      order: 'the throwing one, then its partner',
      text: A_THROWING_FUNCTION_THEN_THE_PARTNER_IT_CALLS,
      found: [
        { calls: 'throwsAtTheBottom', where: 'top level' },
        { calls: 'stepsDown', where: 'top level' },
      ],
    },
    {
      order: 'the partner, then the throwing one',
      text: THE_PARTNER_THEN_THE_THROWING_FUNCTION_IT_CALLS,
      found: [
        { calls: 'stepsDown', where: 'top level' },
        { calls: 'throwsAtTheBottom', where: 'top level' },
      ],
    },
  ])('finds the partner of a throwing function by the throw it reaches, called as $order', ({ text, found }) => {
    expect(collectTimeThrowsOfTestFile(text)).toStrictEqual(found)
  })

  it('finds none where neither of them throws', () => {
    expect(collectTimeThrowsOfTestFile(TWO_FUNCTIONS_CALLING_EACH_OTHER_NEITHER_THROWING)).toStrictEqual([])
  })
})

describe('collectTimeThrowsIn, on functions that call back into a caller, read first from the one that throws', () => {
  it.each<{ readonly shape: string; readonly text: string; readonly found: readonly CollectTimeThrow[] }>([
    {
      shape: 'a loop of three',
      text: A_LOOP_OF_THREE_FROM_ITS_THROWING_MEMBER_THEN_ANOTHER,
      found: [
        { calls: 'startsTheLoop', where: 'top level' },
        { calls: 'goesRound', where: 'top level' },
      ],
    },
    {
      shape: 'a function calling itself and its caller',
      text: A_FUNCTION_CALLING_ITSELF_AND_ITS_THROWING_CALLER,
      found: [
        { calls: 'throwsAfterItsPartner', where: 'top level' },
        { calls: 'callsItselfAndBack', where: 'top level' },
      ],
    },
    {
      shape: 'an inner loop the caller reaches a second way',
      text: AN_INNER_LOOP_REACHED_AGAIN_UNDER_ITS_THROWING_CALLER,
      found: [
        { calls: 'throwsAfterBothReads', where: 'top level' },
        { calls: 'reachesTheInnerLoop', where: 'top level' },
      ],
    },
  ])('finds each function that reaches the throw through $shape when called again', ({ text, found }) => {
    expect(collectTimeThrowsOfTestFile(text)).toStrictEqual(found)
  })
})

describe('collectTimeThrowsIn, on a chain of helpers each calling the next twice', () => {
  // Each call the finder resolves as it reads a body asks whether its function is ours, and each import it follows may
  // ask whether its module is, so the asks count the reads.
  it('reads each helper once, asking whether a function or module is ours no more often than calls and imports are written', () => {
    const isOursCounted = vi.fn(isOurs)
    expect(collectTimeThrowsOfTestFile(A_CALL_DOWN_A_CHAIN_OF_SHARED_HELPERS_NONE_THROWING, isOursCounted)).toStrictEqual([])
    expect(isOursCounted.mock.calls.length).toBeLessThanOrEqual(CALLS_WRITTEN_DOWN_THE_CHAIN + IMPORTS_WRITTEN_IN_A_CHAIN_TEST_FILE)
  })

  it('reads each helper of a chain whose bottom calls its top once, asking no more often than calls and imports are written', () => {
    const isOursCounted = vi.fn(isOurs)
    expect(collectTimeThrowsOfTestFile(A_CALL_ROUND_A_LOOP_OF_SHARED_HELPERS, isOursCounted)).toStrictEqual([])
    expect(isOursCounted.mock.calls.length).toBeLessThanOrEqual(CALLS_WRITTEN_ROUND_THE_LOOP + IMPORTS_WRITTEN_IN_A_CHAIN_TEST_FILE)
  })

  it('finds only the callers that throw where a chain and a loop they read are called again alone', () => {
    expect(collectTimeThrowsOfTestFile(SHARED_HELPERS_CALLED_AGAIN_AFTER_A_THROWING_CALLER_READ_THEM)).toStrictEqual([
      { calls: 'throwsAfterTheChain', where: 'top level' },
      { calls: 'throwsAfterTheLoop', where: 'top level' },
    ])
  })

  it('finds the call whose chain ends in a throw', () => {
    expect(collectTimeThrowsOfTestFile(A_CALL_DOWN_A_CHAIN_OF_SHARED_HELPERS_ENDING_IN_A_THROW)).toStrictEqual([
      { calls: 'throwingLevel0', where: 'top level' },
    ])
  })
})

// A helper's top level runs while vitest collects each test file loading it, so a call there that reaches a throw of
// ours is the test file's, named by the module it is written in.
describe('collectTimeThrowsIn, on the helper modules a test file loads', () => {
  it('finds a call at the top level of a helper the test file imports, naming the helper', () => {
    expect(collectTimeThrowsOfTestFile(A_TEST_FILE_LOADING_A_HELPER_THAT_LOOKS_UP_AT_ITS_TOP)).toStrictEqual([
      { calls: 'lookUp', where: 'top level', module: LOOKED_UP_AT_THE_TOP_FILE },
    ])
  })

  it('finds none in a helper whose top level only declares, or calls what cannot throw', () => {
    expect(collectTimeThrowsOfTestFile(A_TEST_FILE_LOADING_A_HELPER_THAT_ONLY_DECLARES)).toStrictEqual([])
  })

  it('finds a call at the top level of a helper loaded only through another, naming the one it is written in', () => {
    expect(collectTimeThrowsOfTestFile(A_TEST_FILE_LOADING_A_HELPER_THROUGH_ANOTHER)).toStrictEqual([
      { calls: 'lookUp', where: 'top level', module: LOOKED_UP_FURTHER_DOWN_FILE },
    ])
  })

  it('finds none in a helper loaded through another whose top level only declares', () => {
    expect(collectTimeThrowsOfTestFile(A_TEST_FILE_LOADING_A_HELPER_THAT_ONLY_DECLARES_THROUGH_ANOTHER)).toStrictEqual([])
  })

  it('finds none in a helper whose top level calls a function outside our files, however it throws', () => {
    expect(collectTimeThrowsOfTestFile(A_TEST_FILE_LOADING_A_HELPER_THAT_CALLS_A_LIBRARY_AT_ITS_TOP)).toStrictEqual([])
  })

  it('finds none in a helper the test file imports only a type from', () => {
    expect(collectTimeThrowsOfTestFile(A_TEST_FILE_IMPORTING_ONLY_A_TYPE_FROM_A_HELPER_THAT_LOOKS_UP)).toStrictEqual([])
  })

  it("finds a helper's call once where the test file loads it directly and through another helper", () => {
    expect(collectTimeThrowsOfTestFile(A_TEST_FILE_LOADING_ONE_HELPER_DIRECTLY_AND_THROUGH_ANOTHER)).toStrictEqual([
      { calls: 'lookUp', where: 'top level', module: LOOKED_UP_AT_THE_TOP_FILE },
    ])
  })

  it("finds a helper's call once where two helpers import each other", () => {
    expect(collectTimeThrowsOfTestFile(A_TEST_FILE_LOADING_HELPERS_THAT_IMPORT_EACH_OTHER)).toStrictEqual([
      { calls: 'lookUp', where: 'top level', module: CYCLE_START_FILE },
    ])
  })

  it("finds a helper's call before the test file's own, as vitest runs them", () => {
    expect(collectTimeThrowsOfTestFile(A_TEST_FILE_LOOKING_UP_WITH_WHAT_A_HELPER_LOOKED_UP_AT_ITS_TOP)).toStrictEqual([
      { calls: 'lookUp', where: 'top level', module: LOOKED_UP_AT_THE_TOP_FILE },
      { calls: 'lookUp', where: 'top level' },
    ])
  })
})
