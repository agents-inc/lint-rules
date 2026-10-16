import { describe, expect, it } from 'vitest'
import { buildFilesTerm } from '../__tests__/factories/files-condition-factories.ts'
import { overrideFilesOf } from './oxlint-override-files.ts'

// How an override names a term's files (oxlint-override-files.ts): its first glob in `files`, each
// other negated in `excludeFiles`, where oxlint reads a negated glob as every file it does not match;
// a negated glob of the term as the files it negates, in `excludeFiles`; and a glob with no slash,
// which ESLint reads in the config's folder alone, written from that folder.
describe('overrideFilesOf', () => {
  it.each([
    {
      how: 'a negated glob alone as every file, less those it negates',
      term: buildFilesTerm(['!src/gen/**']),
      written: [{ files: ['**/*'], excludeFiles: ['src/gen/**'] }],
    },
    {
      how: 'a negated glob beside another as the other, less those it negates',
      term: buildFilesTerm(['src/**', '!src/gen/**']),
      written: [{ files: ['src/**'], excludeFiles: ['src/gen/**'] }],
    },
    {
      how: 'a glob of the config folder alone from that folder, excluding no file',
      term: buildFilesTerm(['*.ts']),
      written: [{ files: ['./*.ts'] }],
    },
    {
      how: 'a glob of the config folder alone in files, and the other glob of the term negated in excludeFiles',
      term: buildFilesTerm(['**/*.ts', '*.config.ts']),
      written: [{ files: ['./*.config.ts'], excludeFiles: ['!**/*.ts'] }],
    },
  ])('writes $how', ({ term, written }) => {
    expect(overrideFilesOf([term])).toStrictEqual(written)
  })
})
