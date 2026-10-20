// Files at the depths that folder-style patterns tell apart (`generated`, `legacy/`, `**/gen`,
// `vendor/**`, `a.js`): a folder at the root and one in src, a file named like the folder, and a
// file of the same name in other folders. Each line draws one rule, noted beside it.

// no-debugger (1); eqeqeq under always (2); no-undef for `window`, which the browser env declares (3);
// no-warning-comments under its default terms (4)
const JAVASCRIPT_SOURCE = `debugger
export const same = (a, b) => a == b
export const shown = window
// todo: remove this
`

// no-debugger (1); eqeqeq under always (2); no-warning-comments under its default terms (3). no-undef
// runs in no TS file of ours.
const TYPESCRIPT_SOURCE = `debugger
export const same = (a: number, b: number): boolean => a == b
// todo: remove this
`

export const FOLDER_LAYOUT_JS_FILES = [
  'a.js',
  'b.js',
  'generated.js',
  'generated/a.js',
  'src/generated/a.js',
  'legacy/a.js',
  'src/legacy.js',
  'src/legacy/deep/a.js',
  'gen/a.js',
  'src/gen.js',
  'src/gen/a.js',
  'vendor/a.js',
  'vendor/deep/a.js',
  'src/vendor/a.js',
  'dist/a.js',
  'src/dist.js',
  'src/a.js',
  'src/deep/a.js',
  'src/kept.js',
] as const

const FOLDER_LAYOUT_TS_FILES = ['src/b.ts', 'lib/b.ts'] as const

/** Sorted as oxlint's findings are. */
export const FOLDER_LAYOUT_FILES: readonly string[] = [...FOLDER_LAYOUT_JS_FILES, ...FOLDER_LAYOUT_TS_FILES].toSorted()

export const folderLayoutSourceFiles: Readonly<Record<string, string>> = Object.fromEntries([
  ...FOLDER_LAYOUT_JS_FILES.map((file): [string, string] => [file, JAVASCRIPT_SOURCE]),
  ...FOLDER_LAYOUT_TS_FILES.map((file): [string, string] => [file, TYPESCRIPT_SOURCE]),
])
