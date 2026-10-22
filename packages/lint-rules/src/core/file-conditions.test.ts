import { describe, expect, it } from 'vitest'
import { buildDrawnTerms, type Draw, seededDraws } from '../__tests__/factories/files-condition-factories.ts'
import { filesTheConditionMatches } from '../__tests__/files-condition-oracle.ts'
import { bothOf, eitherOf, type FilesCondition, type FilesTerm, filesAndIgnoresOf, notOf } from './file-conditions.ts'

// Each case checks the files algebra file by file against plain sets.

type Drawn = { readonly condition: FilesCondition; readonly files: readonly string[] }

// Paths at the depths the globs tell apart, a literal path's file among them.
const FILES = [
  'src/a.ts',
  'src/a.js',
  'src/b.ts',
  'scripts/s1.ts',
  'scripts/s2.ts',
  'scripts/s3.js',
  'legacy/a.ts',
  'legacy/keep/a.ts',
  'out/f1.ts',
  'out/f2.ts',
  'a.ts',
]
// src/b.ts is written both bare and with a leading ./, which name the same file.
const GLOBS = [
  '**/*.ts',
  '**/*.{js,ts}',
  '**/*.js',
  'src/**',
  'scripts/**',
  'legacy/**',
  'out/**',
  '**/legacy/**',
  'scripts/s1.ts',
  'scripts/s2.ts',
  'out/f1.ts',
  'src/a.ts',
  'a.ts',
  'src/b.ts',
  './src/b.ts',
]
const SEED = 7
const CASES = 3000
// About 2 s alone, and past vitest's default 5 s on a loaded machine (measured).
const DRAWN_CASES_TIMEOUT_MS = 60_000
// Large repos hold tens of thousands of TS files outside every tsconfig. Linear time takes under 0.2 s here;
// a pairwise step took seconds at a tenth of this count (measured). The ceiling sits between the two.
const PATH_COUNT = 20_000
const SHAPE_CEILING_MS = 5_000
const SHAPE_TEST_TIMEOUT_MS = 60_000

function drawn(draw: Draw): Drawn {
  const condition = eitherOf(buildDrawnTerms(draw, GLOBS))
  return { condition, files: filesTheConditionMatches(condition, FILES) }
}

/** As `check: case`. */
function mismatchesOverCases(): string[] {
  const draw = seededDraws(SEED)
  return Array.from({ length: CASES }, (_, index) => index).flatMap((index) => {
    const [first, second, third] = [drawn(draw), drawn(draw), drawn(draw)]
    const checks = [
      { check: 'either', got: eitherOf(first.condition, second.condition), owed: FILES.filter((file) => first.files.includes(file) || second.files.includes(file)) },
      {
        check: 'both',
        got: bothOf(first.condition, second.condition, third.condition),
        owed: FILES.filter((file) => first.files.includes(file) && second.files.includes(file) && third.files.includes(file)),
      },
      { check: 'not', got: notOf(first.condition), owed: FILES.filter((file) => !first.files.includes(file)) },
      {
        check: 'not of either',
        got: notOf(eitherOf(first.condition, second.condition)),
        owed: FILES.filter((file) => !first.files.includes(file) && !second.files.includes(file)),
      },
    ]
    return checks.filter(({ got, owed }) => !isDeepEqual(filesTheConditionMatches(got, FILES), owed)).map(({ check }) => `${check}: ${String(index)}`)
  })
}

function isDeepEqual(files: readonly string[], others: readonly string[]): boolean {
  return files.length === others.length && files.every((file, index) => others[index] === file)
}

function literalPaths(folder: string): string[] {
  return Array.from({ length: PATH_COUNT }, (_, index) => `${folder}/f${String(index)}.ts`)
}

function termsNaming(paths: readonly string[]): FilesTerm[] {
  return paths.map((path) => ({ all: [path], none: [] }))
}

function keysOf(condition: FilesCondition): string[] {
  return condition.map((term) => JSON.stringify(term)).toSorted()
}

function timed(shape: () => FilesCondition): { readonly condition: FilesCondition; readonly ms: number } {
  const start = performance.now()
  const condition = shape()
  return { condition, ms: performance.now() - start }
}

describe('bothOf, eitherOf and notOf, against plain sets of files', () => {
  it(`match the files the sets give, in each of ${String(CASES)} drawn cases`, { timeout: DRAWN_CASES_TIMEOUT_MS }, () => {
    expect(mismatchesOverCases()).toStrictEqual([])
  })
})

// ESLint reads an empty files entry as every file (measured, 10.12), so only the written block tells these apart.
describe('filesAndIgnoresOf', () => {
  it('writes a term needing no glob as every file, its exclusions as ignores', () => {
    expect(filesAndIgnoresOf([{ all: [], none: ['legacy/**'] }])).toStrictEqual([{ files: null, ignores: ['legacy/**'] }])
  })

  it('writes terms sharing their exclusions as every file where one of them needs no glob', () => {
    expect(filesAndIgnoresOf([{ all: ['src/**'], none: ['legacy/**'] }, { all: [], none: ['legacy/**'] }])).toStrictEqual([
      { files: null, ignores: ['legacy/**'] },
    ])
  })

  it('lists the globs of terms sharing their exclusions where each needs one', () => {
    expect(filesAndIgnoresOf([{ all: ['src/**'], none: [] }, { all: ['lib/**', '**/*.ts'], none: [] }])).toStrictEqual([
      { files: [['src/**'], ['lib/**', '**/*.ts']], ignores: [] },
    ])
  })
})

// The drawn cases compare files alone, which an exclusion of another path never changes.
describe('a term naming one literal path, as bothOf writes it', () => {
  it('keeps the exclusions naming no path and drops one naming another path', () => {
    expect(bothOf([{ all: ['src/**'], none: [] }], [{ all: ['./src/a.ts'], none: ['src/b.ts', '**/gen/**'] }])).toStrictEqual([
      { all: ['src/**', 'src/a.ts'], none: ['**/gen/**'] },
    ])
  })

  it('meets no file where an exclusion names its own path, written with a leading ./', () => {
    expect(bothOf([{ all: ['src/a.ts'], none: [] }], [{ all: ['**/*.ts'], none: ['./src/a.ts'] }])).toStrictEqual([])
  })
})

describe(`the algebra, given ${String(PATH_COUNT)} literal paths`, () => {
  const paths = literalPaths('a')
  const otherPaths = literalPaths('b')
  const typeScriptFilesBut = (excluded: readonly string[]): FilesTerm => ({ all: ['**/*.ts'], none: [...excluded] })
  const javaScriptFilesBut = (excluded: readonly string[]): FilesTerm => ({ all: ['**/*.js'], none: [...excluded] })

  it.each([
    {
      shape: 'either of them, each a term of its own',
      run: () => eitherOf(termsNaming(paths)),
      owed: () => termsNaming(paths),
    },
    {
      shape: 'not of them',
      run: () => notOf(eitherOf(termsNaming(paths))),
      owed: () => [{ all: [], none: paths.toSorted() }],
    },
    {
      shape: 'both of them and as many others, which no file meets',
      run: () => bothOf(eitherOf(termsNaming(paths)), eitherOf(termsNaming(otherPaths))),
      owed: () => [],
    },
    {
      shape: 'both of two conditions holding them all, each beside a glob of its own',
      run: () => bothOf(eitherOf(termsNaming(paths), [typeScriptFilesBut(otherPaths)]), eitherOf(termsNaming(paths), [javaScriptFilesBut(otherPaths)])),
      owed: () => [...termsNaming(paths), { all: ['**/*.js', '**/*.ts'], none: otherPaths.toSorted() }],
    },
  ])('meet $shape in time linear in their number', { timeout: SHAPE_TEST_TIMEOUT_MS }, ({ run, owed }) => {
    const { condition, ms } = timed(run)

    expect(keysOf(condition)).toStrictEqual(keysOf(owed()))
    expect(ms).toBeLessThan(SHAPE_CEILING_MS)
  })
})
