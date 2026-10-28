import { describe, expect, it } from 'vitest'
import { autofixedFilesIn, findingMessagesIn, findingsIn, findingsInFile, lastLineOf, linesOf, notCheckedIn } from './check-output.ts'
import {
  CHECK_STDOUT_WITH_EVERY_KIND_OF_LINE,
  CHECK_STDOUT_WITHOUT_AUTOFIXED_LINE,
  CHECK_STDOUT_WITH_A_MALFORMED_AUTOFIXED_LINE,
  CHECK_STDOUT_WITH_NOT_CHECKED_ENTRIES,
} from './cases/check-stdouts.ts'

describe('linesOf', () => {
  it('splits on newlines, leaving out the empty string after the last one', () => {
    expect(linesOf('a\nb\n')).toStrictEqual(['a', 'b'])
  })

  it('keeps a last line printed without a newline', () => {
    expect(linesOf('a\nb')).toStrictEqual(['a', 'b'])
  })
})

describe('findingsIn', () => {
  it("gives each finding line's file, line and label, the warning mark kept, in the order printed: paths with spaces, a parse error and an unused suppression included", () => {
    expect(findingsIn(CHECK_STDOUT_WITH_EVERY_KIND_OF_LINE)).toStrictEqual([
      'src/with space.ts:2 no-debugger',
      'src/broken.ts:4 parse error',
      'src/allowed.ts:3 unused suppression',
      'src/empty.test.ts:0 sonarjs/no-empty-test-file',
      'src/cart.ts:30 no-console (warning)',
    ])
  })

  it('reads no finding from the autofixed, cut or summary lines', () => {
    expect(findingsIn(CHECK_STDOUT_WITHOUT_AUTOFIXED_LINE)).toStrictEqual([])
  })
})

describe('findingsInFile', () => {
  it('gives the findings in that file, and none in a file whose path it starts', () => {
    expect(findingsInFile('src/a.ts:1 no-debugger — m\nsrc/a.tsx:1 no-debugger — m\nsrc/a.ts:2 no-var — m\n', 'src/a.ts')).toStrictEqual([
      'src/a.ts:1 no-debugger',
      'src/a.ts:2 no-var',
    ])
  })
})

describe('findingMessagesIn', () => {
  it('gives each finding its message, one holding the separator kept whole', () => {
    expect(findingMessagesIn(CHECK_STDOUT_WITH_EVERY_KIND_OF_LINE).get('src/allowed.ts:3 unused suppression')).toBe(
      'suppresses no-console, which reported nothing here — twice',
    )
  })
})

describe('autofixedFilesIn', () => {
  it('gives the files the autofixed line names', () => {
    expect(autofixedFilesIn(CHECK_STDOUT_WITH_EVERY_KIND_OF_LINE)).toStrictEqual(['src/a.ts', 'src/with space.ts'])
  })

  it('gives none where check printed no autofixed line', () => {
    expect(autofixedFilesIn(CHECK_STDOUT_WITHOUT_AUTOFIXED_LINE)).toStrictEqual([])
  })

  it('refuses an autofixed line that ends otherwise than the spec says', () => {
    expect(() => autofixedFilesIn(CHECK_STDOUT_WITH_A_MALFORMED_AUTOFIXED_LINE)).toThrow(/does not end as the spec says/u)
  })
})

describe('lastLineOf', () => {
  it('gives the summary, the last line', () => {
    expect(lastLineOf(CHECK_STDOUT_WITHOUT_AUTOFIXED_LINE)).toBe('check: no findings in 2 changed files.')
  })

  it('refuses an empty stdout', () => {
    expect(() => lastLineOf('')).toThrow(/printed nothing/u)
  })
})

describe('notCheckedIn', () => {
  it('gives each not-checked entry in the order printed, one quoting text over several lines whole, and reads none of it as a finding', () => {
    expect({ notChecked: notCheckedIn(CHECK_STDOUT_WITH_NOT_CHECKED_ENTRIES), findings: findingsIn(CHECK_STDOUT_WITH_NOT_CHECKED_ENTRIES) }).toStrictEqual({
      notChecked: [
        'check: not checked: src/b.ts (it was deleted or replaced while check ran)',
        "check: not checked: oxlint's rules (oxlint failed: Failed to parse oxlint configuration file.\n\n  x Rule 'no-such-rule' not found in plugin 'eslint')",
      ],
      findings: ['src/a.ts:2 no-debugger'],
    })
  })

  it('gives none where check printed none', () => {
    expect(notCheckedIn(CHECK_STDOUT_WITHOUT_AUTOFIXED_LINE)).toStrictEqual([])
  })
})
