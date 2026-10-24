import { describe, expect, it } from 'vitest'
import { filesOnDisk, linesOf, wholeFile } from './__tests__/factories/mutate-entry-factories.ts'
import { changedLinesKeptTo, linesTheRoundIsKeptTo, mutateEntryOf, refuseKeptFilesNoConfigMutates } from './kept-lines.ts'

const LANE_FILE = 'packages/eslint-plugin-house/src/rules/no-section-banner.ts'
const LANE_TEST_FILE = 'packages/eslint-plugin-house/src/rules/no-section-banner.test.ts'
const OTHER_LANE_FILE = 'packages/eslint-plugin-house/src/rules/no-classic-loops.ts'
const UNTRACKED_FILE = 'packages/eslint-plugin-house/src/rules/new-rule.ts'
const LINT_RULES_FILE = 'packages/lint-rules/src/core/editor-parts.ts'
const MISSING_FILE = 'packages/eslint-plugin-house/src/rules/no-such-rule.ts'
const MISSING_LINT_RULES_FILE = 'packages/lint-rules/src/core/no-such-module.ts'
const PATH_FROM_THE_PACKAGE = 'src/rules/no-section-banner.ts'
const LANE_FILE_WITH_A_DOUBLED_SLASH = 'packages//eslint-plugin-house/src/rules/no-section-banner.ts'
const LANE_FILE_STEPPING_OUT_AND_BACK = 'packages/eslint-plugin-house/src/../src/rules/no-section-banner.ts'
const LANE_FILE_FROM_THE_CURRENT_FOLDER = './packages/eslint-plugin-house/src/rules/no-section-banner.ts'
const FILE_WITH_A_COLON = 'packages/eslint-plugin-house/src/rules/rule:draft.ts'

const HOUSE_PATTERNS = ['packages/eslint-plugin-house/src/**/*.ts', '!packages/eslint-plugin-house/src/**/*.test.ts']
const LINT_RULES_PATTERNS = ['packages/lint-rules/src/**/*.ts', '!packages/lint-rules/src/**/*.test.ts']

const ONLY = '--only'
const FORCE = '--force'
const TEST_FILES = '--testFiles'
const TEST_FILES_SHORT = '-t'
const DRY_RUN_ONLY = '--dryRunOnly'

describe('linesTheRoundIsKeptTo', () => {
  it('keeps the round to no list (null), and passes Stryker every argument, when given no --only', () => {
    expect(linesTheRoundIsKeptTo([FORCE, TEST_FILES, LANE_TEST_FILE])).toStrictEqual({
      keptTo: null,
      strykerArguments: [FORCE, TEST_FILES, LANE_TEST_FILE],
    })
  })

  it('keeps the round to the files and line ranges after --only, and passes Stryker the arguments around it', () => {
    expect(linesTheRoundIsKeptTo([FORCE, ONLY, `${LANE_FILE},${OTHER_LANE_FILE}:10-20`, TEST_FILES, LANE_TEST_FILE])).toStrictEqual({
      keptTo: [wholeFile(LANE_FILE), linesOf(OTHER_LANE_FILE, 10, 20)],
      strykerArguments: [FORCE, TEST_FILES, LANE_TEST_FILE],
    })
  })

  it('keeps the round to the lists of every --only given', () => {
    expect(linesTheRoundIsKeptTo([ONLY, LANE_FILE, DRY_RUN_ONLY, ONLY, OTHER_LANE_FILE])).toStrictEqual({
      keptTo: [wholeFile(LANE_FILE), wholeFile(OTHER_LANE_FILE)],
      strykerArguments: [DRY_RUN_ONLY],
    })
  })

  it("drops an empty entry from the list, as Stryker's own lists do", () => {
    expect(linesTheRoundIsKeptTo([ONLY, `,${LANE_FILE},,${OTHER_LANE_FILE},`]).keptTo).toStrictEqual([wholeFile(LANE_FILE), wholeFile(OTHER_LANE_FILE)])
  })

  it.each<{ readonly spelling: string; readonly file: string }>([
    { spelling: 'a doubled slash', file: LANE_FILE_WITH_A_DOUBLED_SLASH },
    { spelling: 'a step out of a folder and back in', file: LANE_FILE_STEPPING_OUT_AND_BACK },
    { spelling: 'a leading ./', file: LANE_FILE_FROM_THE_CURRENT_FOLDER },
  ])('keeps the round to a file spelt with $spelling as the path git prints, so its changed lines are kept', ({ file }) => {
    const { keptTo } = linesTheRoundIsKeptTo([ONLY, `${file}:10-20`])

    expect(keptTo).toStrictEqual([linesOf(LANE_FILE, 10, 20)])
    expect(changedLinesKeptTo([`${LANE_FILE}:5-30`], keptTo)).toStrictEqual([`${LANE_FILE}:10-20`])
  })

  it.each<{ readonly refused: string; readonly argumentsGiven: readonly string[] }>([
    { refused: 'an --only that ends the arguments', argumentsGiven: [FORCE, ONLY] },
    { refused: 'an --only followed by another option', argumentsGiven: [ONLY, FORCE, LANE_FILE] },
    { refused: 'an --only whose list holds no entry', argumentsGiven: [ONLY, ','] },
  ])('refuses $refused', ({ argumentsGiven }) => {
    expect(() => linesTheRoundIsKeptTo(argumentsGiven)).toThrow(
      new Error('--only takes a comma-separated list of files, each alone or as <file>:<startLine>-<endLine>'),
    )
  })

  it("refuses an --only followed by one of Stryker's short options, as -t for --testFiles, rather than reading it as a file", () => {
    expect(() => linesTheRoundIsKeptTo([ONLY, TEST_FILES_SHORT, LANE_TEST_FILE])).toThrow(
      new Error('--only takes a comma-separated list of files, each alone or as <file>:<startLine>-<endLine>'),
    )
  })

  it.each<{ readonly refused: string; readonly entry: string }>([
    { refused: 'a path that holds a colon', entry: FILE_WITH_A_COLON },
    { refused: 'a path that holds a colon, with a line range', entry: `${FILE_WITH_A_COLON}:1-2` },
    { refused: 'a range with columns', entry: `${LANE_FILE}:10:5-20:3` },
    { refused: 'a single line number', entry: `${LANE_FILE}:10` },
    { refused: 'an empty range', entry: `${LANE_FILE}:` },
  ])("refuses, naming the entry, $refused typed after --only, though git's own entries may hold a colon", ({ entry }) => {
    expect(() => linesTheRoundIsKeptTo([ONLY, entry])).toThrow(new Error(`${entry}: give a file alone, or its lines as <file>:<startLine>-<endLine>`))
  })
})

describe('mutateEntryOf', () => {
  it('reads a file alone as the whole file', () => {
    expect(mutateEntryOf(LANE_FILE)).toStrictEqual(wholeFile(LANE_FILE))
  })

  it('reads a file with a line range as those lines, a range of one line and one from the first line among them', () => {
    expect([`${LANE_FILE}:12-40`, `${LANE_FILE}:7-7`, `${LANE_FILE}:1-1`].map(mutateEntryOf)).toStrictEqual([
      linesOf(LANE_FILE, 12, 40),
      linesOf(LANE_FILE, 7, 7),
      linesOf(LANE_FILE, 1, 1),
    ])
  })

  it.each<{ readonly refused: string; readonly entry: string }>([
    { refused: 'a range that ends before it starts', entry: `${LANE_FILE}:20-10` },
    { refused: 'a range starting at line 0, as lines count from 1', entry: `${LANE_FILE}:0-10` },
    { refused: "a range with columns, which Stryker's --mutate takes and --only does not", entry: `${LANE_FILE}:10:5-20:3` },
    { refused: 'a single line number', entry: `${LANE_FILE}:10` },
    { refused: 'an empty range', entry: `${LANE_FILE}:` },
  ])('refuses, naming the entry, $refused', ({ entry }) => {
    expect(() => mutateEntryOf(entry)).toThrow(new Error(`${entry}: give a file alone, or its lines as <file>:<startLine>-<endLine>`))
  })
})

describe('changedLinesKeptTo', () => {
  const changed = [`${LANE_FILE}:10-30`, `${LANE_FILE}:50-52`, `${OTHER_LANE_FILE}:5-9`, UNTRACKED_FILE]

  it('gives every changed line, in the order given, when the round is kept to no list (null)', () => {
    expect(changedLinesKeptTo(changed, null)).toStrictEqual(changed)
  })

  it("keeps every hunk of a file kept whole, and drops other files' hunks and an untracked file not kept", () => {
    expect(changedLinesKeptTo(changed, [wholeFile(LANE_FILE)])).toStrictEqual([`${LANE_FILE}:10-30`, `${LANE_FILE}:50-52`])
  })

  it('cuts a hunk to the part inside a kept range, keeps a hunk inside it whole, and drops a hunk outside it', () => {
    expect(changedLinesKeptTo(changed, [linesOf(LANE_FILE, 20, 51)])).toStrictEqual([`${LANE_FILE}:20-30`, `${LANE_FILE}:50-51`])
    expect(changedLinesKeptTo(changed, [linesOf(LANE_FILE, 1, 40)])).toStrictEqual([`${LANE_FILE}:10-30`])
  })

  it('keeps a hunk that shares one line with a kept range to that line', () => {
    expect(changedLinesKeptTo(changed, [linesOf(LANE_FILE, 30, 45)])).toStrictEqual([`${LANE_FILE}:30-30`])
  })

  it('gives an untracked file, all of whose lines are new, the range kept of it', () => {
    expect(changedLinesKeptTo(changed, [linesOf(UNTRACKED_FILE, 3, 8), wholeFile(OTHER_LANE_FILE)])).toStrictEqual([
      `${OTHER_LANE_FILE}:5-9`,
      `${UNTRACKED_FILE}:3-8`,
    ])
  })

  it('cuts a hunk to each of two kept ranges of its file, unmerged, as Stryker reads two --mutate ranges', () => {
    expect(changedLinesKeptTo(changed, [linesOf(LANE_FILE, 12, 14), linesOf(LANE_FILE, 25, 60)])).toStrictEqual([
      `${LANE_FILE}:12-14`,
      `${LANE_FILE}:25-30`,
      `${LANE_FILE}:50-52`,
    ])
  })

  it('gives nothing for a kept file with no changed line', () => {
    expect(changedLinesKeptTo(changed, [wholeFile(LINT_RULES_FILE)])).toStrictEqual([])
  })
})

describe('changedLinesKeptTo, on a changed file whose path holds a colon', () => {
  const changedHunks = [`${FILE_WITH_A_COLON}:1-2`, `${LANE_FILE}:4-4`]
  const untrackedFiles = [FILE_WITH_A_COLON, `${LANE_FILE}:4-4`]

  it('gives its hunk as given when the round is kept to no list (null)', () => {
    expect(changedLinesKeptTo(changedHunks, null)).toStrictEqual(changedHunks)
  })

  it.each<{ readonly how: string; readonly changed: readonly string[] }>([
    { how: 'a changed hunk of it', changed: changedHunks },
    { how: 'it untracked', changed: untrackedFiles },
  ])('drops $how, and keeps the hunk of the file --only names, when --only names another file', ({ changed }) => {
    expect(changedLinesKeptTo(changed, [wholeFile(LANE_FILE)])).toStrictEqual([`${LANE_FILE}:4-4`])
  })

  it.each<{ readonly how: string; readonly changed: readonly string[]; readonly kept: readonly string[] }>([
    { how: 'a changed hunk of it, reading the range as the last :<start>-<end>', changed: changedHunks, kept: [`${FILE_WITH_A_COLON}:2-2`] },
    { how: 'it untracked, as the whole file', changed: untrackedFiles, kept: [`${FILE_WITH_A_COLON}:2-9`] },
  ])('keeps $how, to the range kept of it, when a kept entry names it', ({ changed, kept }) => {
    expect(changedLinesKeptTo(changed, [linesOf(FILE_WITH_A_COLON, 2, 9)])).toStrictEqual(kept)
  })
})

describe('refuseKeptFilesNoConfigMutates', () => {
  const isOnDisk = filesOnDisk([LANE_FILE, OTHER_LANE_FILE, LANE_TEST_FILE, LINT_RULES_FILE])

  it('accepts files on disk that some config of the round mutates, whole or by range', () => {
    expect(() =>
      refuseKeptFilesNoConfigMutates([wholeFile(LANE_FILE), linesOf(LINT_RULES_FILE, 3, 9)], [LINT_RULES_PATTERNS, HOUSE_PATTERNS], isOnDisk),
    ).not.toThrow()
  })

  it('refuses, naming each, files that are not on disk', () => {
    expect(() =>
      refuseKeptFilesNoConfigMutates([wholeFile(MISSING_FILE), wholeFile(LANE_FILE), linesOf(MISSING_LINT_RULES_FILE, 3, 9)], [LINT_RULES_PATTERNS, HOUSE_PATTERNS], isOnDisk),
    ).toThrow(new Error(`--only names no file at ${MISSING_FILE}, ${MISSING_LINT_RULES_FILE}: give each path from the repo root, as git diff prints it`))
  })

  it("refuses, naming each, a test file, a path from inside a package, and a file only a config outside the round mutates", () => {
    const isOnDiskToo = filesOnDisk([LANE_FILE, LANE_TEST_FILE, PATH_FROM_THE_PACKAGE, LINT_RULES_FILE])

    expect(() =>
      refuseKeptFilesNoConfigMutates(
        [wholeFile(LANE_FILE), wholeFile(LANE_TEST_FILE), wholeFile(PATH_FROM_THE_PACKAGE), linesOf(LINT_RULES_FILE, 3, 9)],
        [HOUSE_PATTERNS],
        isOnDiskToo,
      ),
    ).toThrow(new Error(`No config of this round mutates ${LANE_TEST_FILE}, ${PATH_FROM_THE_PACKAGE}, ${LINT_RULES_FILE}: give source files it mutates, as git diff prints them`))
  })

  it('refuses a single file that is not on disk, naming it', () => {
    expect(() => refuseKeptFilesNoConfigMutates([wholeFile(MISSING_FILE)], [LINT_RULES_PATTERNS, HOUSE_PATTERNS], isOnDisk)).toThrow(
      new Error(`--only names no file at ${MISSING_FILE}: give each path from the repo root, as git diff prints it`),
    )
  })

  it('refuses a single file only a config outside the round mutates, naming it', () => {
    expect(() => refuseKeptFilesNoConfigMutates([linesOf(LINT_RULES_FILE, 3, 9)], [HOUSE_PATTERNS], isOnDisk)).toThrow(
      new Error(`No config of this round mutates ${LINT_RULES_FILE}: give source files it mutates, as git diff prints them`),
    )
  })

  it('refuses a path given from inside a package, which is no file from the repo root, as naming no file, the refusal that says to give it from the root', () => {
    expect(() => refuseKeptFilesNoConfigMutates([wholeFile(PATH_FROM_THE_PACKAGE)], [LINT_RULES_PATTERNS, HOUSE_PATTERNS], isOnDisk)).toThrow(
      new Error(`--only names no file at ${PATH_FROM_THE_PACKAGE}: give each path from the repo root, as git diff prints it`),
    )
  })
})
