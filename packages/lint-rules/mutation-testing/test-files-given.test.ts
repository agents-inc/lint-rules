import { describe, expect, it } from 'vitest'
import { TEST_FILES_SPELLINGS } from './__tests__/factories/test-files-spellings.ts'
import { testFilesGiven, testFilesListsWithNoEntry } from './test-files-given.ts'

const SPEC = 'packages/eslint-plugin-house/src/rules/no-section-banner.test.ts'
const OTHER_SPEC = 'packages/lint-rules/src/core/editor-parts.test.ts'
const SPEC_GLOB = 'packages/eslint-plugin-house/src/**/*.test.ts'
const SOURCE = 'packages/eslint-plugin-house/src/rules/no-section-banner.ts'
const OTHER_SOURCE = 'packages/eslint-plugin-house/src/rules/no-classic-loops.ts'

const TEST_FILES = '--testFiles'
const TEST_FILES_ASSIGNED = '--testFiles='
const TEST_FILES_SHORT = '-t'
const TEST_FILES_SHORT_ASSIGNED = '-t='
const TIMEOUT = '--timeoutMS'
const TIMEOUT_MS = '60000'
const TEST_RUNNER = '--testRunner'
const VITEST = 'vitest'
const NO_ENTRY = ','
const COMMAS_ALONE = ',,'
const EMPTY_LIST = ''
const MUTATE = '--mutate'
const FORCE = '--force'
const CONCURRENCY = '--concurrency'
const TWO_WORKERS = '2'

describe('testFilesGiven', () => {
  it('gives no entry when Stryker is given no --testFiles, though another of its options takes a list', () => {
    expect(testFilesGiven([FORCE, MUTATE, `${SOURCE},${OTHER_SOURCE}`, CONCURRENCY, TWO_WORKERS])).toStrictEqual([])
  })

  it.each(TEST_FILES_SPELLINGS)('gives each entry of the list given as $spelling, and nothing of the options around it', ({ given }) => {
    expect(testFilesGiven([MUTATE, `${SOURCE},${OTHER_SOURCE}`, ...given(`${SPEC},${SPEC_GLOB}`), CONCURRENCY, TWO_WORKERS])).toStrictEqual([
      SPEC,
      SPEC_GLOB,
    ])
  })

  it("drops an empty entry from the list, as Stryker's own lists drop them", () => {
    expect(testFilesGiven([TEST_FILES, `,${SPEC},,${OTHER_SPEC},`])).toStrictEqual([SPEC, OTHER_SPEC])
  })

  it('reads all that is attached to -t as its list, as Stryker does, so -t=<spec> gives an entry that begins with =', () => {
    expect(testFilesGiven([`${TEST_FILES_SHORT_ASSIGNED}${SPEC}`])).toStrictEqual([`=${SPEC}`])
  })

  it('reads no list from an option that only begins with t, such as --timeoutMS or --testRunner', () => {
    expect(testFilesGiven([TIMEOUT, TIMEOUT_MS, TEST_RUNNER, VITEST])).toStrictEqual([])
  })
})

describe('testFilesListsWithNoEntry', () => {
  it('gives none when Stryker is given no --testFiles, or lists that each hold an entry, one beside empty entries', () => {
    expect([testFilesListsWithNoEntry([FORCE]), testFilesListsWithNoEntry([TEST_FILES, `,${SPEC},`, TEST_FILES_SHORT, OTHER_SPEC])]).toStrictEqual([[], []])
  })

  it.each(TEST_FILES_SPELLINGS)('gives a list that holds no entry as it was given, given as $spelling', ({ given }) => {
    expect(testFilesListsWithNoEntry([FORCE, ...given(NO_ENTRY), CONCURRENCY, TWO_WORKERS])).toStrictEqual([NO_ENTRY])
  })

  it('gives each list that holds no entry, an empty one and one of commas alone among them, and not a list beside them that holds one', () => {
    expect(testFilesListsWithNoEntry([TEST_FILES_ASSIGNED, TEST_FILES, SPEC, TEST_FILES_SHORT, COMMAS_ALONE])).toStrictEqual([EMPTY_LIST, COMMAS_ALONE])
  })
})
