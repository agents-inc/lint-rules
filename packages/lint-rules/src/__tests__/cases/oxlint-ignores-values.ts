import {
  ESLINT_READING_LIMITS,
  FILES_IN_NAMED_FOLDERS,
  IGNORES_READ_AS_ESLINT_READS_THEM,
  IGNORES_TAKING_FILES_BACK_FROM_ESLINT_DEFAULTS,
} from './eslint-ignores-values.ts'

// Lists of our ignores over which the shared oxlint reading is checked against the real oxlint, given the agent
// build's ignorePatterns (core/ignores-read-by-each-engine.integration.test.ts).

/** A list the reading reads differently from oxlint, and the files only it takes back: it leaves out none oxlint lints. */
export type OxlintReadingLimit = { readonly ignores: readonly string[]; readonly takenBackByTheReadingOnly: readonly string[] }

/** What a negated keep line takes back from a legacy line. */
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

/** No file sits under a dot-folder: the oracle's `**`, as node's matchesGlob, crosses none where oxlint's does. */
export const OXLINT_READING_FILES: readonly string[] = [
  ...FILES_IN_NAMED_FOLDERS,
  'node_modules/a.js',
  'node_modules/x/a.js',
  'node_modules/legacy/a.js',
  'src/node_modules/a.js',
  'legacy/node_modules/a.js',
]

/**
* The agent build's `**\/node_modules/**` matches every such file, so only a line matching the file itself takes
* it back (measured, oxlint 1.87).
*/
const IGNORES_TAKING_NODE_MODULES_FILES_BACK: readonly (readonly string[])[] = [['!node_modules/x/**'], ['!**/a.js']]

/**
* Where a negated line takes back a folder, oxlint decides a file under a deeper folder of the left-out name by
* that folder, which the globs cannot tell (measured, oxlint 1.87): a pinned limit.
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

/** Lists the reading reads exactly as oxlint does (measured, oxlint 1.87). */
export const IGNORES_READ_AS_OXLINT_READS_THEM: readonly (readonly string[])[] = [
  ...IGNORES_READ_AS_ESLINT_READS_THEM,
  ...IGNORES_TAKING_FILES_BACK_FROM_ESLINT_DEFAULTS,
  ...ESLINT_READING_LIMITS.map(({ ignores }) => ignores),
  ...IGNORES_TAKING_NODE_MODULES_FILES_BACK,
].filter((ignores) => !LIMITED.has(JSON.stringify(ignores)))
