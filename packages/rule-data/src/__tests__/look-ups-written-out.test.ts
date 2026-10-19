import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  A_LOOK_UP_THROUGH_FOUND_OR,
  A_LOOK_UP_WRITTEN_OUT,
  SOURCES_WRITING_OUT_A_LOOK_UP,
  SOURCES_WRITING_OUT_NO_LOOK_UP,
} from './cases/look-ups-written-out.ts'
import { linesWritingOutALookUp, lookUpsWrittenOutIn } from './look-ups-written-out.ts'
import { setUpTempDir } from './temp-dirs.ts'

describe('linesWritingOutALookUp', () => {
  it.each(SOURCES_WRITING_OUT_A_LOOK_UP)('finds $how', ({ source, lines }) => {
    expect(linesWritingOutALookUp(source)).toStrictEqual(lines)
  })

  it.each(SOURCES_WRITING_OUT_NO_LOOK_UP)('leaves $how', ({ source }) => {
    expect(linesWritingOutALookUp(source)).toStrictEqual([])
  })
})

describe('lookUpsWrittenOutIn', () => {
  const tempDir = setUpTempDir('look-ups-written-out-')
  const files: Readonly<Record<string, string>> = {
    'a.ts': A_LOOK_UP_WRITTEN_OUT,
    'nested/b.ts': A_LOOK_UP_WRITTEN_OUT,
    'through-found-or.ts': A_LOOK_UP_THROUGH_FOUND_OR,
    'a.test.ts': A_LOOK_UP_WRITTEN_OUT,
    'a.test-d.ts': A_LOOK_UP_WRITTEN_OUT,
    '__tests__/helper.ts': A_LOOK_UP_WRITTEN_OUT,
    'nested/__tests__/helper.ts': A_LOOK_UP_WRITTEN_OUT,
    'notes.md': A_LOOK_UP_WRITTEN_OUT,
  }

  beforeAll(async () => {
    await Promise.all(
      Object.entries(files).map(async ([file, source]) => {
        await mkdir(dirname(join(tempDir(), file)), { recursive: true })
        await writeFile(join(tempDir(), file), source)
      }),
    )
  })

  it('names each in the TypeScript source as file:line, and none in a test, a type test, a __tests__ folder or another kind of file', () => {
    expect(lookUpsWrittenOutIn(tempDir())).toStrictEqual(['a.ts:2', 'nested/b.ts:2'])
  })
})
