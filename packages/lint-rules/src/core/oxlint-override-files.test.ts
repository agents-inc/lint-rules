import { describe, expect, it } from 'vitest'
import { buildFilesTerm } from '../__tests__/factories/files-condition-factories.ts'
import { overrideFilesOf } from './oxlint-override-files.ts'

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
    {
      how: 'a glob of every file, then a folder glob, as the folder glob alone',
      term: buildFilesTerm(['**/*', 'src/**']),
      written: [{ files: ['src/**'] }],
    },
    {
      how: 'a folder glob, then a glob of every file, as the folder glob alone',
      term: buildFilesTerm(['src/**', '**/*']),
      written: [{ files: ['src/**'] }],
    },
    {
      how: "a glob the term's earlier globs join into, as that glob alone",
      term: buildFilesTerm(['src/**', '**/*.ts', 'src/**/*.ts']),
      written: [{ files: ['src/**/*.ts'] }],
    },
    {
      how: 'two globs of the config folder alone as the first in files, and the second negated at any depth in excludeFiles',
      term: buildFilesTerm(['*.config.ts', '*.spec.ts']),
      written: [{ files: ['./*.config.ts'], excludeFiles: ['!**/*.spec.ts'] }],
    },
    {
      how: 'a path beside a glob of its extension as the path alone',
      term: buildFilesTerm(['src/a.ts', '**/*.ts']),
      written: [{ files: ['src/a.ts'] }],
    },
    {
      how: 'a path beside a glob of another extension as no override',
      term: buildFilesTerm(['src/a.ts', '**/*.js']),
      written: [],
    },
    {
      how: 'a path beside a glob of several extensions, its own among them, as the path alone',
      term: buildFilesTerm(['src/a.ts', '**/*.{js,ts}']),
      written: [{ files: ['src/a.ts'] }],
    },
    {
      how: 'a path beside a glob of several extensions, its own not among them, as no override',
      term: buildFilesTerm(['src/a.ts', '**/*.{js,jsx}']),
      written: [],
    },
    {
      how: "a path ending in an extension's letters with no dot before them, beside a glob of that extension, as no override",
      term: buildFilesTerm(['src/gets', '**/*.ts']),
      written: [],
    },
    {
      how: 'a ./-led path in a folder, beside a glob of every file in that folder, as the path alone',
      term: buildFilesTerm(['./src/a.ts', 'src/**']),
      written: [{ files: ['./src/a.ts'] }],
    },
    {
      how: 'a path outside a folder, beside a glob of every file in that folder, as no override',
      term: buildFilesTerm(['lib/a.ts', 'src/**']),
      written: [],
    },
    {
      how: 'a glob of every file in a folder, then a glob in that folder, as the glob in it alone',
      term: buildFilesTerm(['src/**', 'src/gen/*.ts']),
      written: [{ files: ['src/gen/*.ts'] }],
    },
  ])('writes $how', ({ term, written }) => {
    expect(overrideFilesOf([term])).toStrictEqual(written)
  })
})
