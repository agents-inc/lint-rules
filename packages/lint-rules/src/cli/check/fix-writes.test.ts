import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportedConstFixedFromLet, exportedLet, moduleText, oxlintFixRunWriting } from '../../__tests__/factories/check-factories.ts'
import { setUpTempProjects, textsOf } from '../../__tests__/temp-projects.ts'
import { fixInPlace, textOfFileAt, writeIfStillUnchanged } from './fix-writes.ts'

// spec-cli.md "The fix step": ESLint's fixed text is written only while the file still holds the
// text ESLint read (F-6); oxlint fixes in place. A fix check wrote is never put back, however the
// run ends (decided 2026-10-15): fix-step.test.ts covers a run a signal or a failure stops.

const tempProjects = setUpTempProjects()

const FIRST = 'src/first.ts'
const SECOND = 'src/second.ts'
// A path no file is at.
const GONE = 'src/gone.ts'
const FIRST_BEFORE_FIXES = moduleText(exportedLet('first'))
const SECOND_BEFORE_FIXES = moduleText(exportedLet('second'))
const FIRST_AFTER_FIXES = moduleText(exportedConstFixedFromLet('first'))
const SECOND_AFTER_FIXES = moduleText(exportedConstFixedFromLet('second'))
const BEFORE_FIXES = { [FIRST]: FIRST_BEFORE_FIXES, [SECOND]: SECOND_BEFORE_FIXES }
const AFTER_FIXES = { [FIRST]: FIRST_AFTER_FIXES, [SECOND]: SECOND_AFTER_FIXES }
const ANOTHER_WRITERS_TEXT = moduleText(exportedLet('rewrittenMeanwhile'))

function pathsIn(projectDir: string): string[] {
  return [FIRST, SECOND].map((file) => join(projectDir, file))
}

describe("writing ESLint's fixed text", () => {
  it('writes it over a file that still holds the text ESLint read', () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const path = join(projectDir, FIRST)

    expect({ written: writeIfStillUnchanged(path, FIRST_BEFORE_FIXES, FIRST_AFTER_FIXES), text: readFileSync(path, 'utf8') }).toStrictEqual({
      written: true,
      text: FIRST_AFTER_FIXES,
    })
  })

  it('leaves a file another writer changed after ESLint read it as that writer left it', () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const path = join(projectDir, FIRST)
    writeFileSync(path, ANOTHER_WRITERS_TEXT)

    expect({ written: writeIfStillUnchanged(path, FIRST_BEFORE_FIXES, FIRST_AFTER_FIXES), text: readFileSync(path, 'utf8') }).toStrictEqual({
      written: false,
      text: ANOTHER_WRITERS_TEXT,
    })
  })
})

describe("oxlint's fix run in place", () => {
  it('keeps what it wrote when it ends on its own', async () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })

    expect({ run: await fixInPlace(pathsIn(projectDir), oxlintFixRunWriting(projectDir, AFTER_FIXES), new AbortController().signal), contents: textsOf(projectDir, [FIRST, SECOND]) }).toStrictEqual({
      run: { outcome: 'completed' },
      contents: AFTER_FIXES,
    })
  })
})

describe('the text of a file as a fix run left it', () => {
  // No permission to read: a file is there, so check stops rather than read it as gone.
  const NO_PERMISSIONS = 0o000

  it('is null where no file is there any more, and refused where a file is there that check may not read', () => {
    const projectDir = tempProjects.create({ files: BEFORE_FIXES })
    const unreadable = join(projectDir, FIRST)
    chmodSync(unreadable, NO_PERMISSIONS)

    expect(textOfFileAt(join(projectDir, GONE))).toBeNull()
    expect(() => textOfFileAt(unreadable)).toThrowError(expect.objectContaining({ code: 'EACCES' }))
  })
})
