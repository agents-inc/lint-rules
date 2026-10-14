import {
  ESLINT_READING_LIMITS,
  FILES_IN_NAMED_FOLDERS,
  IGNORES_READ_AS_ESLINT_READS_THEM,
  IGNORES_TAKING_FILES_BACK_FROM_ESLINT_DEFAULTS,
} from './eslint-ignores-values.ts'

// Lists of our ignores, as our layers hold them, over which the shared oxlint reading of our ignores
// is checked against the real oxlint, given the ignorePatterns the agent build gives it
// (core/ignores-read-by-each-engine.integration.test.ts): every list the ESLint reading is checked
// over, and lines taking a file in node_modules back, which the agent build's own `**/node_modules/**`
// leaves out.

/** A list of our ignores the reading reads differently from oxlint, and the files it takes back that oxlint leaves out: it leaves out none oxlint lints. */
export type OxlintReadingLimit = { readonly ignores: readonly string[]; readonly takenBackByTheReadingOnly: readonly string[] }

/** Every file in a keep folder holding a legacy folder, or in a legacy folder inside a keep folder: what a negated keep line takes back from a legacy line. */
const IN_A_LEGACY_FOLDER_UNDER_KEEP = [
  'keep/keep/legacy/a.js',
  'keep/legacy/a.js',
  'keep/legacy/legacy/a.js',
  'keep/legacy/src/a.js',
  'keep/legacy/x/a.js',
  'keep/src/legacy/a.js',
  'keep/x/legacy/a.js',
  'legacy/keep/legacy/a.js',
  'src/keep/legacy/a.js',
  'x/keep/legacy/a.js',
]

/**
 * The files the oxlint reading is checked over: those the ESLint reading is, but in no .git folder,
 * and a file in node_modules at the root, in a package and below another folder. No file lies under a
 * folder whose name starts with a dot: the files-condition oracle matches globs as node's matchesGlob
 * does, whose `**` crosses no such folder where oxlint's ignorePatterns cross it, so such a file would
 * show the oracle's difference, not the reading's (measured: .git/a.js under **\/a.js).
 */
export const OXLINT_READING_FILES: readonly string[] = [
  ...FILES_IN_NAMED_FOLDERS,
  'node_modules/a.js',
  'node_modules/x/a.js',
  'node_modules/legacy/a.js',
  'src/node_modules/a.js',
  'legacy/node_modules/a.js',
]

/**
 * Lines taking files in node_modules back as files: the agent build's `**\/node_modules/**` matches
 * every such file, so only a line matching the file itself takes it back (measured, oxlint 1.87).
 */
const IGNORES_TAKING_NODE_MODULES_FILES_BACK: readonly (readonly string[])[] = [['!node_modules/x/**'], ['!**/a.js']]

/**
 * Lists the reading takes back files from that oxlint leaves out, each with those files (measured,
 * oxlint 1.87, every file given by its path): where a negated line takes back a folder, oxlint decides
 * a file under a folder of the left-out name below it by that deeper folder, which the globs cannot
 * tell (decisions.md, 2026-10-12 "fix round 2, after its developer": a limit, pinned).
 */
export const OXLINT_READING_LIMITS: readonly OxlintReadingLimit[] = [
  { ignores: ['legacy/', '!legacy/keep/'], takenBackByTheReadingOnly: ['legacy/keep/legacy/a.js'] },
  { ignores: ['legacy/', '!keep/'], takenBackByTheReadingOnly: IN_A_LEGACY_FOLDER_UNDER_KEEP },
  { ignores: ['**/legacy', '!legacy/keep'], takenBackByTheReadingOnly: ['legacy/keep/legacy/a.js'] },
  { ignores: ['**/legacy', '!src/legacy'], takenBackByTheReadingOnly: ['src/legacy/legacy/a.js'] },
  { ignores: ['legacy/', '!legacy/keep/', 'legacy/keep/deep/'], takenBackByTheReadingOnly: ['legacy/keep/legacy/a.js'] },
  { ignores: ['**/legacy/', '!src/legacy/'], takenBackByTheReadingOnly: ['src/legacy/legacy/a.js'] },
  { ignores: ['**/legacy', '!**/keep'], takenBackByTheReadingOnly: IN_A_LEGACY_FOLDER_UNDER_KEEP },
  {
    ignores: ['keep/', '!legacy/'],
    takenBackByTheReadingOnly: [
      'keep/legacy/keep/a.js',
      'legacy/keep/a.js',
      'legacy/keep/keep/a.js',
      'legacy/keep/src/a.js',
      'legacy/keep/x/a.js',
      'legacy/legacy/keep/a.js',
      'legacy/src/keep/a.js',
      'legacy/x/keep/a.js',
      'src/legacy/keep/a.js',
      'x/legacy/keep/a.js',
    ],
  },
  { ignores: ['legacy/', '!**/keep/'], takenBackByTheReadingOnly: IN_A_LEGACY_FOLDER_UNDER_KEEP },
  { ignores: ['!legacy/keep/', 'legacy/'], takenBackByTheReadingOnly: ['legacy/keep/legacy/a.js'] },
  { ignores: ['src/', '!src/legacy/', 'src/legacy/keep/'], takenBackByTheReadingOnly: ['src/legacy/src/a.js'] },
  { ignores: ['**/legacy', '!legacy/keep', '!**/keep'], takenBackByTheReadingOnly: IN_A_LEGACY_FOLDER_UNDER_KEEP },
  { ignores: ['**/legacy/', '!x/legacy/'], takenBackByTheReadingOnly: ['x/legacy/legacy/a.js'] },
  { ignores: ['**/legacy/', '!legacy/legacy/'], takenBackByTheReadingOnly: ['legacy/legacy/legacy/a.js'] },
]

const LIMITED = new Set(OXLINT_READING_LIMITS.map(({ ignores }) => JSON.stringify(ignores)))

/** Lists the reading leaves out exactly the files oxlint leaves out of (measured, oxlint 1.87): every list the ESLint reading is checked over, but the limits. */
export const IGNORES_READ_AS_OXLINT_READS_THEM: readonly (readonly string[])[] = [
  ...IGNORES_READ_AS_ESLINT_READS_THEM,
  ...IGNORES_TAKING_FILES_BACK_FROM_ESLINT_DEFAULTS,
  ...ESLINT_READING_LIMITS.map(({ ignores }) => ignores),
  ...IGNORES_TAKING_NODE_MODULES_FILES_BACK,
].filter((ignores) => !LIMITED.has(JSON.stringify(ignores)))
