import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { foldersUpTo } from './folders.ts'

const TOP_LEVEL = join(sep, 'repo')
const PACKAGES = join(TOP_LEVEL, 'packages')
const PACKAGE = join(PACKAGES, 'app')
// A name that only starts with two dots is a folder inside, not the way up.
const FOLDER_NAMED_WITH_TWO_DOTS = join(TOP_LEVEL, '..app')
const OUTSIDE = join(sep, 'elsewhere', 'app')

describe('the folders from one up to the git top level', () => {
  it('are the folder and each above it, the top level last', () => {
    expect(foldersUpTo(PACKAGE, TOP_LEVEL)).toStrictEqual([PACKAGE, PACKAGES, TOP_LEVEL])
  })

  it('are the top level alone, from the top level', () => {
    expect(foldersUpTo(TOP_LEVEL, TOP_LEVEL)).toStrictEqual([TOP_LEVEL])
  })

  it('walk up from a folder at the top level named with two leading dots', () => {
    expect(foldersUpTo(FOLDER_NAMED_WITH_TWO_DOTS, TOP_LEVEL)).toStrictEqual([FOLDER_NAMED_WITH_TWO_DOTS, TOP_LEVEL])
  })

  it('are the folder alone where it is not inside the top level', () => {
    expect(foldersUpTo(OUTSIDE, TOP_LEVEL)).toStrictEqual([OUTSIDE])
  })
})
