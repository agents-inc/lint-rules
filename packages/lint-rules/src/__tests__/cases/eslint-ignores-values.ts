// Lists of our ignores, as a consumer writes them, over which the shared ESLint reading of the forms
// our layers hold them in is checked against the real ESLint
// (core/ignores-read-by-each-engine.integration.test.ts). They are the fix developer's parity
// corpus (fix round 2): the grid's values, every shape of a folder value with negated values after
// it, and the values each break of the reading was measured to change; and lists taking files back
// from ESLint's default ignores, which hold in the editor whatever our negated lines say.

/** A list of our ignores the reading reads differently from ESLint, and the files it takes in that ESLint leaves out: it leaves out none ESLint lints. */
export type EslintReadingLimit = { readonly ignores: readonly string[]; readonly takenInByTheReadingOnly: readonly string[] }

const FOLDER_NAMES = ['legacy', 'keep', 'src', 'x']
const MOST_FOLDERS_DEEP = 3
const FILE_NAME = 'a.js'

/** Every path of folders as deep as given or less, each folder named one of the folder names: the root's empty path first. */
function folderPathsOfUpTo(depth: number): string[][] {
  if (depth === 0) return [[]]
  const shallower = folderPathsOfUpTo(depth - 1)
  const deepest = shallower.filter((path) => path.length === depth - 1)
  return [...shallower, ...deepest.flatMap((path) => FOLDER_NAMES.map((name) => [...path, name]))]
}

/** a.js at the root, and in every folder of up to three of the names legacy, keep, src and x. */
export const FILES_IN_NAMED_FOLDERS: readonly string[] = folderPathsOfUpTo(MOST_FOLDERS_DEEP).map((path) => [...path, FILE_NAME].join('/'))

/**
 * Files in a node_modules folder, at the root, in a package and below another folder, which ESLint's
 * default ignores leave out; and in the root .git folder, which they leave out too.
 */
export const FILES_ESLINT_DEFAULTS_LEAVE_OUT: readonly string[] = [
  'node_modules/a.js',
  'node_modules/x/a.js',
  'node_modules/legacy/a.js',
  'src/node_modules/a.js',
  'legacy/node_modules/a.js',
  '.git/a.js',
  '.git/x/a.js',
]

/**
 * The files the ESLint reading is checked over. No other file lies under a folder whose name starts
 * with a dot: the files-condition oracle matches globs as node's matchesGlob does, whose `**` crosses
 * no such folder where ESLint's crosses it, so such a file would show the oracle's difference, not
 * the reading's (measured: src/.git/a.js under **\/a.js).
 */
export const ESLINT_READING_FILES: readonly string[] = [...FILES_IN_NAMED_FOLDERS, ...FILES_ESLINT_DEFAULTS_LEAVE_OUT]

/**
 * Lists the reading leaves out exactly the files ESLint leaves out of, in the editor (measured, ESLint
 * 10.12). The first is no list at all: ESLint's default ignores alone.
 */
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
 * Lists taking files back from ESLint's default ignores, which the agent build's ESLint lints, as our
 * ignores are global there, and the editor's does not: there our ignores are not global (D-a), so the
 * default ignores hold whatever our negated lines say (decisions.md, 2026-10-12 "fix round 2, after
 * its second review"). Some take back a node_modules or .git folder by name, the others a folder
 * holding one: `!src/**` takes back src/node_modules (measured, ESLint 10.12).
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
 * Lists the reading takes in files from that ESLint leaves out, each with those files (measured,
 * ESLint 10.12): a legacy folder in a keep folder in a legacy folder, which ESLint leaves out by the
 * highest legacy folder; the files directly in a legacy folder a negated value takes back under
 * another folder, which shows only beside a negated file value; and a negated value the globs
 * cannot read as a folder.
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
  // !legacy/ names every legacy folder (q62), as !**/legacy/ does above.
  {
    ignores: ['legacy/**', '!legacy/', '!**/a.js'],
    takenInByTheReadingOnly: ['legacy/keep/legacy/a.js', 'legacy/src/legacy/a.js', 'legacy/x/legacy/a.js'],
  },
]
