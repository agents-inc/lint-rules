import { describe, expect, it } from 'vitest'
import { filesMatchingAll, JS_AND_TS_FILES } from './eslint-file-types.ts'

// ESLint lints every file a block's glob matches, so a block of ours is kept to JS and TS files, the
// only ones our parser and plugins are registered for, unless one of its globs keeps it there itself.

const TEST_FILES = '**/*.test.ts'
const FILES_IN_A_FOLDER = 'src/legacy/**'
const EVERY_FILE_BUT_A_TEST = '!**/*.test.ts'

describe('filesMatchingAll', () => {
  it('writes a glob of JS or TS files alone as it is', () => {
    expect(filesMatchingAll([[TEST_FILES]])).toStrictEqual([TEST_FILES])
  })

  it('keeps a folder glob, which names no extension, to the JS and TS files in it', () => {
    expect(filesMatchingAll([[FILES_IN_A_FOLDER]])).toStrictEqual([[FILES_IN_A_FOLDER, JS_AND_TS_FILES]])
  })

  it('keeps a negated glob of TS files, which matches every other file, to the JS and TS files', () => {
    expect(filesMatchingAll([[EVERY_FILE_BUT_A_TEST]])).toStrictEqual([[EVERY_FILE_BUT_A_TEST, JS_AND_TS_FILES]])
  })
})
