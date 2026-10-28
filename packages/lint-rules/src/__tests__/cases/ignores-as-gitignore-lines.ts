// Each top-level `ignores` value means what it would as a .gitignore line, in both engines and every build.
// No slash: any depth. Only a trailing slash: every folder of that name. A leading ./ or /: anchored at the root.
// Any other slash, and **/…: anchored. A negated value follows the same rules after its !.

export type IgnoresRow = { readonly ignores: readonly string[]; readonly leftOut: readonly string[] }

export const IGNORED_FILES: readonly string[] = ['a.js', 'src/a.js', 'legacy/a.js', 'src/legacy/a.js', 'legacy/keep/a.js']

export const EVERY_FILE_IN_A_LEGACY_FOLDER = '**/legacy/**'

export const EVERY_LEGACY_FOLDER: readonly string[] = ['legacy/a.js', 'src/legacy/a.js', 'legacy/keep/a.js']
const THE_ROOT_LEGACY_FOLDER = ['legacy/a.js', 'legacy/keep/a.js']
const EVERY_A_JS_BUT_THE_ROOTS = ['src/a.js', 'legacy/a.js', 'src/legacy/a.js', 'legacy/keep/a.js']

/** Each form, beside forms read the same way. */
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

/** More forms, read through the shared readings of our ignores alone. */
export const MORE_IGNORES_AS_GITIGNORE_LINES: readonly IgnoresRow[] = [
  { ignores: ['**/a.js', '!/a.js'], leftOut: EVERY_A_JS_BUT_THE_ROOTS },
  { ignores: ['**/a.js', '!./src/a.js'], leftOut: ['a.js', 'legacy/a.js', 'src/legacy/a.js', 'legacy/keep/a.js'] },
  { ignores: ['**/a.js', '!/src/a.js'], leftOut: ['a.js', 'legacy/a.js', 'src/legacy/a.js', 'legacy/keep/a.js'] },
  { ignores: ['**/a.js', '!a.js'], leftOut: [] },
  { ignores: ['legacy/**'], leftOut: THE_ROOT_LEGACY_FOLDER },
  { ignores: ['src/a.js'], leftOut: ['src/a.js'] },
]

/**
* Our ignores leaving out every a.js but the root one, beside an entry over every legacy folder: the files a
* .gitignore reading leaves the entry's rules in.
*/
export const ROOT_TAKE_BACKS_BESIDE_AN_ENTRY: {
  readonly files: readonly string[]
  readonly ignoresLists: ReadonlyArray<readonly string[]>
  readonly entryRunsIn: readonly string[]
} = {
  files: ['a.js', 'legacy/a.js', 'legacy/b.js', 'legacy/x/a.js', 'src/legacy/a.js'],
  ignoresLists: [
    ['**/a.js', '!./a.js'],
    ['**/a.js', '!/a.js'],
  ],
  entryRunsIn: ['legacy/b.js'],
}

/** ESLint keeps a file under a left-out folder out; oxlint takes it back (measured, ESLint 10.12, oxlint 1.87). A written limit. */
export const NEGATED_UNDER_A_LEFT_OUT_FOLDER: IgnoresRow & { readonly files: readonly string[] } = {
  files: ['a.js', 'lib/a.js', 'lib/b.js'],
  ignores: ['lib/**', '!lib/a.js'],
  leftOut: ['lib/b.js'],
}
