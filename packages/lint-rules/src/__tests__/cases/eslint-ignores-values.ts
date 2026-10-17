// Lists of our ignores over which the shared ESLint reading is checked against the real ESLint
// (core/ignores-read-by-each-engine.integration.test.ts).

/** A list the reading reads differently from ESLint, and the files only it takes in: it leaves out none ESLint lints. */
export type EslintReadingLimit = { readonly ignores: readonly string[]; readonly takenInByTheReadingOnly: readonly string[] }

const FOLDER_NAMES = ['legacy', 'keep', 'src', 'x']
const MOST_FOLDERS_DEEP = 3
const FILE_NAME = 'a.js'

function folderPathsOfUpTo(depth: number): string[][] {
  if (depth === 0) return [[]]
  const shallower = folderPathsOfUpTo(depth - 1)
  const deepest = shallower.filter((path) => path.length === depth - 1)
  return [...shallower, ...deepest.flatMap((path) => FOLDER_NAMES.map((name) => [...path, name]))]
}

export const FILES_IN_NAMED_FOLDERS: readonly string[] = folderPathsOfUpTo(MOST_FOLDERS_DEEP).map((path) => [...path, FILE_NAME].join('/'))

export const FILES_ESLINT_DEFAULTS_LEAVE_OUT: readonly string[] = [
  'node_modules/a.js',
  'node_modules/x/a.js',
  'node_modules/legacy/a.js',
  'src/node_modules/a.js',
  'legacy/node_modules/a.js',
  '.git/a.js',
  '.git/x/a.js',
]

/** No other file sits under a dot-folder: the oracle's `**`, as node's matchesGlob, crosses none where ESLint's does. */
export const ESLINT_READING_FILES: readonly string[] = [...FILES_IN_NAMED_FOLDERS, ...FILES_ESLINT_DEFAULTS_LEAVE_OUT]

/** Lists the reading reads exactly as ESLint does in the editor (measured, ESLint 10.12); the first is ESLint's defaults alone. */
export const IGNORES_READ_AS_ESLINT_READS_THEM: readonly (readonly string[])[] = [
  [],
  ['**/generated'],
  ['legacy/'],
  ['vendor/'],
  ['**/gen/'],
  ['vendor/**'],
  ['**/a.js'],
  ['./src/a.js'],
  ['/src/a.js'],
  ['lib/**', '!lib/a.js'],
  ['lib/**/*', '!lib/a.js'],
  ['legacy/', '!legacy/keep/'],
  ['lib/', '!lib/a.js'],
  ['!lib/a.js', 'lib/**'],
  ['legacy/', '!keep/'],
  ['legacy/', '!legacy/keep/index.js'],
  ['legacy/**', '!legacy/keep/'],
  ['vendor/**', '!vendor/keep/'],
  ['**/lib', '!lib/a.js'],
  ['**/*.js', '!src/'],
  ['lib/*', '!lib/a.js'],
  ['**/legacy', '!legacy/keep'],
  ['**/legacy', '!src/legacy'],
  ['legacy/', '!legacy/keep/', 'legacy/keep/deep/'],
  ['src/legacy/'],
  ['legacy/**', '!legacy/keep/**'],
  ['legacy/*', '!legacy/keep'],
  ['**/legacy/', '!src/legacy/'],
  ['**/legacy/', '!src/legacy/keep/'],
  ['**/legacy', '!**/keep'],
  ['keep/', '!legacy/'],
  ['**/*.vue'],
  ['src/*.vue'],
  ['legacy/', '!**/keep/'],
  ['!legacy/keep/', 'legacy/'],
  ['src/', '!src/legacy/', 'src/legacy/keep/'],
  ['legacy/', '!legacy/keep/', '!legacy/keep/legacy/'],
  ['**/legacy', '!legacy/keep', '!**/keep'],
  ['**/legacy/', '!legacy/keep/**'],
  ['**/legacy/', '!x/keep/**'],
  ['**/legacy/', '!legacy/'],
  ['**/legacy/', '!x/legacy/'],
  ['**/legacy/**', '!legacy/keep/**'],
  ['**/legacy/**', '!x/legacy/**'],
  ['**/legacy/**', '!**/keep/'],
  ['**/legacy/**', '!**/keep'],
  ['**/legacy/**', '!x/**'],
  ['**/legacy/**', '!legacy/', '!legacy/a.js'],
  ['**/legacy/**', '!legacy/', '!legacy/x/a.js'],
  ['**/legacy/**', '!**/legacy/', '!legacy/a.js'],
  ['**/legacy/', '!legacy/legacy/'],
  ['**/legacy/**', '!legacy/'],
  ['**/legacy/**', '!**/legacy/'],
  ['legacy/**', '!legacy/', '!legacy/a.js'],
  ['legacy/**', '!legacy/x/', '!legacy/x/a.js'],
  ['**/legacy', '!legacy/', '!**/a.js'],
  ['**/legacy/', '!**/legacy', '!**/a.js'],
  ['legacy/**', '!**/keep', '!**/a.js'],
  ['legacy/', '!legacy/**'],
  ['legacy/keep/', '!legacy/**'],
  ['legacy/', '!**/legac?/'],
]

/**
* Lists taking files back from ESLint's default ignores: the agent build, where our ignores are global, lints
* them; the editor's does not. `!src/**` takes back src/node_modules (measured, ESLint 10.12).
*/
export const IGNORES_TAKING_FILES_BACK_FROM_ESLINT_DEFAULTS: readonly (readonly string[])[] = [
  ['!**/node_modules/'],
  ['!node_modules/'],
  ['!node_modules/', 'node_modules/*', '!node_modules/x/'],
  ['!.git/'],
  ['**/*.js', '!src/**'],
  ['**/legacy/**', '!**/legacy/**'],
  ['**/legacy/', '!**/legacy/**'],
  ['**/legacy/', '!src/legacy/', '!src/**'],
]

/**
* Lists the reading takes in files ESLint leaves out (measured, ESLint 10.12): nested legacy folders ESLint
* leaves out by the highest; a negated value taking back a legacy folder's files under another folder; and a
* negated value the globs cannot read as a folder.
*/
export const ESLINT_READING_LIMITS: readonly EslintReadingLimit[] = [
  { ignores: ['**/legacy/**', '!**/keep/**'], takenInByTheReadingOnly: ['legacy/keep/legacy/a.js'] },
  { ignores: ['**/legacy/', '!**/keep/**'], takenInByTheReadingOnly: ['legacy/keep/legacy/a.js'] },
  { ignores: ['**/legacy', '!**/keep/**'], takenInByTheReadingOnly: ['legacy/keep/legacy/a.js'] },
  { ignores: ['**/legacy/**', '!**/keep/**', 'keep/legacy/x/'], takenInByTheReadingOnly: ['legacy/keep/legacy/a.js'] },
  {
    ignores: ['**/legacy/**', '!**/legacy/', '!**/a.js'],
    takenInByTheReadingOnly: ['legacy/keep/legacy/a.js', 'legacy/src/legacy/a.js', 'legacy/x/legacy/a.js'],
  },
  { ignores: ['**/legacy/', '!src/*/legacy/'], takenInByTheReadingOnly: ['src/legacy/legacy/a.js'] },
  {
    ignores: ['legacy/**', '!**/legacy', '!**/a.js'],
    takenInByTheReadingOnly: ['legacy/keep/legacy/a.js', 'legacy/src/legacy/a.js', 'legacy/x/legacy/a.js'],
  },
  // !legacy/ names every legacy folder, as !**/legacy/ does above.
  {
    ignores: ['legacy/**', '!legacy/', '!**/a.js'],
    takenInByTheReadingOnly: ['legacy/keep/legacy/a.js', 'legacy/src/legacy/a.js', 'legacy/x/legacy/a.js'],
  },
]
