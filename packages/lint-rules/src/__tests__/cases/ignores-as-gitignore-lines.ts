// q62 (owner): each top-level `ignores` value means what it would mean as a .gitignore line, the same
// in ESLint and oxlint and in every build. No slash: at any depth. Only a trailing slash: every
// folder of that name. A leading ./ or /: anchored at the project root, a name with no other slash
// included. Any other slash, and **/…: anchored as today. A negated value follows the same rules
// after its !. Each list here, with the files of IGNORED_FILES it leaves out.

/** A list of our ignores, as a consumer writes it, and the files it leaves out. */
export type IgnoresRow = { readonly ignores: readonly string[]; readonly leftOut: readonly string[] }

/** a.js at the root, in src/, in a legacy folder at the root and in src/, and in a folder within the root legacy folder. */
export const IGNORED_FILES: readonly string[] = ['a.js', 'src/a.js', 'legacy/a.js', 'src/legacy/a.js', 'legacy/keep/a.js']

/** The glob of a `fileOverrides` entry over every file in every legacy folder. */
export const EVERY_FILE_IN_A_LEGACY_FOLDER = '**/legacy/**'

/** The files of IGNORED_FILES in a legacy folder: those an entry over EVERY_FILE_IN_A_LEGACY_FOLDER matches. */
export const EVERY_LEGACY_FOLDER: readonly string[] = ['legacy/a.js', 'src/legacy/a.js', 'legacy/keep/a.js']
const THE_ROOT_LEGACY_FOLDER = ['legacy/a.js', 'legacy/keep/a.js']
const EVERY_A_JS_BUT_THE_ROOTS = ['src/a.js', 'legacy/a.js', 'src/legacy/a.js', 'legacy/keep/a.js']

/** Each form the answer names, and the forms read alike today beside them. */
export const IGNORES_AS_GITIGNORE_LINES: readonly IgnoresRow[] = [
  { ignores: ['legacy'], leftOut: EVERY_LEGACY_FOLDER },
  { ignores: ['legacy/'], leftOut: EVERY_LEGACY_FOLDER },
  { ignores: ['./legacy/'], leftOut: THE_ROOT_LEGACY_FOLDER },
  { ignores: ['/legacy/'], leftOut: THE_ROOT_LEGACY_FOLDER },
  { ignores: ['./legacy'], leftOut: THE_ROOT_LEGACY_FOLDER },
  { ignores: ['./a.js'], leftOut: ['a.js'] },
  { ignores: ['/a.js'], leftOut: ['a.js'] },
  { ignores: ['./src/a.js'], leftOut: ['src/a.js'] },
  { ignores: ['/src/a.js'], leftOut: ['src/a.js'] },
  { ignores: ['src/legacy/'], leftOut: ['src/legacy/a.js'] },
  { ignores: ['**/legacy/'], leftOut: EVERY_LEGACY_FOLDER },
  { ignores: ['**/a.js', '!./a.js'], leftOut: EVERY_A_JS_BUT_THE_ROOTS },
]

/** More forms, read through the shared readings of our ignores alone: negated values in each form, and two read alike today. */
export const MORE_IGNORES_AS_GITIGNORE_LINES: readonly IgnoresRow[] = [
  { ignores: ['**/a.js', '!/a.js'], leftOut: EVERY_A_JS_BUT_THE_ROOTS },
  { ignores: ['**/a.js', '!./src/a.js'], leftOut: ['a.js', 'legacy/a.js', 'src/legacy/a.js', 'legacy/keep/a.js'] },
  { ignores: ['**/a.js', '!/src/a.js'], leftOut: ['a.js', 'legacy/a.js', 'src/legacy/a.js', 'legacy/keep/a.js'] },
  { ignores: ['**/a.js', '!a.js'], leftOut: [] },
  { ignores: ['legacy/**'], leftOut: THE_ROOT_LEGACY_FOLDER },
  { ignores: ['src/a.js'], leftOut: ['src/a.js'] },
]

/**
 * Our ignores leaving out every a.js but the root one, in each root form, beside an entry over
 * EVERY_FILE_IN_A_LEGACY_FOLDER: the files, and those a .gitignore reading leaves the entry's rules
 * in. The entry reaches legacy/b.js, beside the a.js files under it, at each depth, that the ignores
 * leave out; the root a.js they take back is in no legacy folder.
 */
export const ROOT_TAKE_BACKS_BESIDE_AN_ENTRY: {
  readonly files: readonly string[]
  readonly ignoresLists: readonly (readonly string[])[]
  readonly entryRunsIn: readonly string[]
} = {
  files: ['a.js', 'legacy/a.js', 'legacy/b.js', 'legacy/x/a.js', 'src/legacy/a.js'],
  ignoresLists: [
    ['**/a.js', '!./a.js'],
    ['**/a.js', '!/a.js'],
  ],
  entryRunsIn: ['legacy/b.js'],
}

/**
 * A negated value taking a file back under a folder another value leaves out: ESLint keeps the file
 * out, oxlint takes it back (measured, ESLint 10.12, oxlint 1.87; a written limit the answer leaves).
 * The files, and those a .gitignore reading leaves out.
 */
export const NEGATED_UNDER_A_LEFT_OUT_FOLDER: IgnoresRow & { readonly files: readonly string[] } = {
  files: ['a.js', 'lib/a.js', 'lib/b.js'],
  ignores: ['lib/**', '!lib/a.js'],
  leftOut: ['lib/b.js'],
}
