import { describe, expect, it } from 'vitest'
import { filesTheConditionMatches } from './files-condition-oracle.ts'

const FILES = ['src/a.ts', 'src/a.js', 'scripts/s.ts', 'a.ts']

describe('filesTheConditionMatches', () => {
  it('keeps a file meeting every glob of a term, and none of its exclusions', () => {
    expect(filesTheConditionMatches([{ all: ['**/*.ts', '**/a.*'], none: ['scripts/**'] }, { all: ['scripts/**'], none: ['**/*.ts'] }], FILES)).toStrictEqual([
      'src/a.ts',
      'a.ts',
    ])
  })

  it('reads a negated glob of `all` as one the file must miss, and a leading ./ as ESLint drops it', () => {
    expect(filesTheConditionMatches([{ all: ['!src/**', './scripts/s.ts'], none: [] }], FILES)).toStrictEqual(['scripts/s.ts'])
  })

  it('keeps a file any one term matches, every file for a term asking nothing, and none for no term', () => {
    expect({
      either: filesTheConditionMatches([{ all: ['a.ts'], none: [] }, { all: ['**/*.js'], none: [] }], FILES),
      askingNothing: filesTheConditionMatches([{ all: [], none: [] }], FILES),
      noTerm: filesTheConditionMatches([], FILES),
    }).toStrictEqual({ either: ['src/a.js', 'a.ts'], askingNothing: FILES, noTerm: [] })
  })
})
