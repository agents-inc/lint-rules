import { chmodSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, onTestFinished } from 'vitest'
import { IMPORTED_ONLY_LAYOUT, TSCONFIG_LAYOUTS } from '../__tests__/cases/tsconfig-layouts.ts'
import { configFileText, standaloneSources } from '../__tests__/factories/tsconfig-layout-factories.ts'
import { PARALLEL_LOAD_TIMEOUT_MS } from '../__tests__/parallel-load.ts'
import { tsFilesTheProjectServiceFindsNoProjectFor, tsFilesUnder } from '../__tests__/project-service-verdicts.ts'
import { type ProjectFiles, setUpTempProjects, writeFileCreatingItsDir } from '../__tests__/temp-projects.ts'
import { isTsFileTheWalkReaches, tsconfigWalkOf } from './ts-files-outside-every-tsconfig.ts'

// Each case compares the computation, file for file, with what the real project service decides.

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const LOCKED_DIRECTORY = 'locked'
const LOCKED_TSCONFIG = 'tsconfig.json'
const NO_PERMISSIONS = 0o000
const OWNER_ONLY_PERMISSIONS = 0o700
const TSCONFIG = 'tsconfig.json'
const INSIDE = 'src/a.ts'
const OUTSIDE = 'stray/b.ts'
const MADE_LATER_INSIDE = 'src/later.ts'
const MADE_LATER_OUTSIDE = 'stray/later.ts'
const TSCONFIG_TAKING_IN_SRC = configFileText({ include: ['src'] })

const tempProjects = setUpTempProjects()

/** The TS files given, every one under the root unless given, that the walk's test reads as listed by no tsconfig, sorted. */
function listedByNoTsconfig(root: string, files: readonly string[] = tsFilesUnder(root)): string[] {
  const { isListed } = tsconfigWalkOf(root)
  return files.filter((file) => !isListed(join(root, file))).toSorted()
}

function writeEach(root: string, files: ProjectFiles): void {
  for (const [file, text] of Object.entries(files)) {
    writeFileCreatingItsDir(join(root, file), text)
  }
}

describe("tsconfigWalkOf's listing, beside the real project service", () => {
  it.each(TSCONFIG_LAYOUTS)(
    'reads as listed by no tsconfig exactly the TS files the project service finds no project for: $shape',
    { timeout: PARALLEL_LOAD_TIMEOUT_MS },
    ({ files, tsconfigRootDir, outside }) => {
      const root = join(tempProjects.create({ files }), tsconfigRootDir)

      expect({
        computed: listedByNoTsconfig(root),
        projectService: tsFilesTheProjectServiceFindsNoProjectFor(root),
      }).toStrictEqual({ computed: outside, projectService: outside })
    },
  )

  it(
    "reads as listed by none a TS file no tsconfig lists though the project service finds it through an importer's program (D-h)",
    { timeout: PARALLEL_LOAD_TIMEOUT_MS },
    () => {
      const { files, tsconfigRootDir, importedOnly, outsideForBoth } = IMPORTED_ONLY_LAYOUT
      const root = join(tempProjects.create({ files }), tsconfigRootDir)

      expect({
        computed: listedByNoTsconfig(root),
        projectService: tsFilesTheProjectServiceFindsNoProjectFor(root),
      }).toStrictEqual({ computed: [importedOnly, ...outsideForBoth].toSorted(), projectService: [...outsideForBoth] })
    },
  )

  it('matches the project service on this repo, file for file', { timeout: PARALLEL_LOAD_TIMEOUT_MS }, () => {
    expect(listedByNoTsconfig(REPO_ROOT)).toStrictEqual(tsFilesTheProjectServiceFindsNoProjectFor(REPO_ROOT))
  })
})

// The editor merges once, as it loads its ESLint config, and asks of each file as it lints it.
describe("tsconfigWalkOf's listing, given TS files made after the walk", () => {
  it('reads them through the tsconfigs as the disk then holds them, though it read the tsconfigs before they were made', () => {
    const root = tempProjects.create({ files: { [TSCONFIG]: TSCONFIG_TAKING_IN_SRC, ...standaloneSources([INSIDE]) } })
    const { isListed } = tsconfigWalkOf(root)
    const isListedBefore = isListed(join(root, INSIDE))
    writeEach(root, standaloneSources([MADE_LATER_INSIDE, MADE_LATER_OUTSIDE]))

    expect({ listedBefore: isListedBefore, inside: isListed(join(root, MADE_LATER_INSIDE)), outside: isListed(join(root, MADE_LATER_OUTSIDE)) }).toStrictEqual({
      listedBefore: true,
      inside: true,
      outside: false,
    })
  })

  // Pinned limit: re-reading the tsconfigs for each file the walk found outside them all would cost a read of
  // every tsconfig per such file, so a tsconfig changed after the first read reaches those files on a restart.
  it('reads a file the walk found through the tsconfigs as first read, though one changed since takes it in', () => {
    const root = tempProjects.create({ files: { [TSCONFIG]: TSCONFIG_TAKING_IN_SRC, ...standaloneSources([INSIDE, OUTSIDE]) } })
    const { isListed } = tsconfigWalkOf(root)
    const isListedBefore = isListed(join(root, INSIDE))
    writeEach(root, { [TSCONFIG]: configFileText({ include: ['src', dirname(OUTSIDE)] }) })

    expect({ listedBefore: isListedBefore, outside: isListed(join(root, OUTSIDE)) }).toStrictEqual({ listedBefore: true, outside: false })
  })
})

describe('isTsFileTheWalkReaches', () => {
  it('holds for a TS file under the root, and not for one above it, under node_modules or .git, or for a JS file', () => {
    const root = tempProjects.create({ files: {} })
    function isReached(path: string): boolean {
      return isTsFileTheWalkReaches(join(root, path), root)
    }

    expect({
      underTheRoot: isReached(OUTSIDE),
      aboveTheRoot: isReached('../b.ts'),
      underNodeModules: isReached('node_modules/pkg/b.ts'),
      underGit: isReached('.git/b.ts'),
      aJsFile: isReached('stray/b.js'),
    }).toStrictEqual({ underTheRoot: true, aboveTheRoot: false, underNodeModules: false, underGit: false, aJsFile: false })
  })
})

// A real project threw EACCES; a directory the walk cannot read is passed over.
describe('tsconfigWalkOf, given a directory it cannot read', () => {
  it('passes over it, and still reads the TS files elsewhere as listed or not', () => {
    const root = tempProjects.create({
      files: {
        [TSCONFIG]: TSCONFIG_TAKING_IN_SRC,
        ...standaloneSources([INSIDE, 'scripts/b.ts', `${LOCKED_DIRECTORY}/c.ts`]),
      },
    })
    chmodSync(join(root, LOCKED_DIRECTORY), NO_PERMISSIONS)
    onTestFinished(() => {
      chmodSync(join(root, LOCKED_DIRECTORY), OWNER_ONLY_PERMISSIONS)
    })

    expect(listedByNoTsconfig(root, [INSIDE, 'scripts/b.ts'])).toStrictEqual(['scripts/b.ts'])
  })
})

describe('tsconfigWalkOf, given a tsconfig it cannot read', () => {
  it('reads it as listing no file, and still tries the tsconfigs above it', () => {
    const root = tempProjects.create({
      files: {
        [TSCONFIG]: TSCONFIG_TAKING_IN_SRC,
        [`src/${LOCKED_TSCONFIG}`]: configFileText({ include: ['**'] }),
        [`scripts/${LOCKED_TSCONFIG}`]: configFileText({ include: ['**'] }),
        ...standaloneSources([INSIDE, 'scripts/b.ts']),
      },
    })
    const lockedTsconfigs = ['src', 'scripts'].map((folder) => join(root, folder, LOCKED_TSCONFIG))
    for (const path of lockedTsconfigs) {
      chmodSync(path, NO_PERMISSIONS)
    }
    onTestFinished(() => {
      for (const path of lockedTsconfigs) {
        chmodSync(path, OWNER_ONLY_PERMISSIONS)
      }
    })

    expect(listedByNoTsconfig(root, [INSIDE, 'scripts/b.ts'])).toStrictEqual(['scripts/b.ts'])
  })
})
