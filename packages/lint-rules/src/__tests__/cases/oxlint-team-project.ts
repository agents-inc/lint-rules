// A team project linted by the real oxlint CLI with the team's config alone and merged with our
// oxlint part. Each source line draws one rule, noted beside it.

export const LINTED_DIR = 'src'

export const sourceFiles = {
  // no-debugger (line 1); typescript/array-type under array-simple (2); eqeqeq under always, not smart (3)
  'src/a.ts': `debugger
export const list: Array<string> = []
export const isMissing = (value: unknown): boolean => value == null
`,
  // no-debugger, in a file a test override matches
  'src/b.test.ts': `debugger
export const y = 1
`,
  // oxlint's default correctness category, one rule per default plugin: oxc, unicorn, typescript
  'src/c.ts': `export const isZero = (value: number): boolean => value * 0 === 0
export const copy = [...[1, 2]]
export enum Letter { A = 'a', B = 'a' }
`,
  // the team's JS plugin rule
  'src/d.ts': `fetch('x')
`,
  // no-undef: a global the team declares (1), and a name nobody declares (2)
  'src/e.js': `export const version = __APP__
undefinedThing()
`,
  // react/jsx-no-duplicate-props, which the react plugin's correctness category turns on (1);
  // react/jsx-key (1)
  'src/f.tsx': `export const List = () => <ul id="a" id="b">{[1].map(() => <li />)}</ul>
`,
  // The same two react rules, in a file a team override for .tsx files does not match
  'src/g.jsx': `export const Other = () => <ul id="a" id="b">{[1].map(() => <li />)}</ul>
`,
  // no-compare-neg-zero: a core rule, in oxlint's eslint scope, which its correctness category turns on
  'src/h.ts': `export const isNegativeZero = (value: number): boolean => value === -0
`,
} as const

/** The folders of a team project whose overrides list the react plugin: src, and lib beside it, which no override for src matches. */
export const REACT_LINTED_DIRS = ['src', 'lib']

// react/jsx-no-duplicate-props, which the react plugin's correctness category turns on, and
// react/jsx-key, both on line 1.
const REACT_SOURCE = `export const List = () => <ul id="a" id="b">{[1].map(() => <li />)}</ul>
`

/** The same react source in four files a team's override globs tell apart: .tsx, .jsx, a test file, and one outside src. */
export const reactSourceFiles = {
  'src/f.tsx': REACT_SOURCE,
  'src/g.jsx': REACT_SOURCE,
  'src/f.test.tsx': REACT_SOURCE,
  'lib/m.tsx': REACT_SOURCE,
} as const

/** A browser script: `window`, a global the browser runtime declares (1), and a name nobody declares (2). */
export const browserSourceFiles = {
  'src/i.js': `window.alert('hi')
undefinedThing()
`,
} as const

export const LOCAL_PLUGIN_FILE = 'lint/local-plugin.js'

export const localPlugin = `export default {
  meta: { name: 'local' },
  rules: {
    'no-direct-fetch': {
      create: (context) => ({
        CallExpression(node) {
          if (node.callee.name === 'fetch') context.report({ node, message: 'no fetch' })
        },
      }),
    },
  },
}
`

/** A browser script in two folders, src and lib, an entry of ours can tell apart. */
export const browserSourceFilesInTwoFolders = {
  'src/i.js': browserSourceFiles['src/i.js'],
  'lib/i.js': browserSourceFiles['src/i.js'],
} as const

/** The folders the browser scripts are in. */
export const BROWSER_LINTED_DIRS = ['src', 'lib']

// typescript/array-type under array-simple (1); a second line, so a max-lines of 1 reports the file.
const ARRAY_TYPE_SOURCE = `export const list: Array<string> = []
export const other = 1
`

// The same, in a TSX file.
const ARRAY_TYPE_TSX_SOURCE = `export const list: Array<string> = []
export const View = () => <div />
`

/**
 * Files where our ESLint part runs a rule or not, by our ignores (dist, and a folder named generated
 * at the root and in src), an entry of ours (legacy), and the rule's own files (max-lines ships for
 * .tsx files but tests).
 */
export const crossEngineSourceFiles = {
  'src/a.ts': ARRAY_TYPE_SOURCE,
  'dist/a.ts': ARRAY_TYPE_SOURCE,
  'legacy/a.ts': ARRAY_TYPE_SOURCE,
  'generated/a.ts': ARRAY_TYPE_SOURCE,
  'src/generated/a.ts': ARRAY_TYPE_SOURCE,
  'src/f.tsx': ARRAY_TYPE_TSX_SOURCE,
  'src/f.test.tsx': ARRAY_TYPE_TSX_SOURCE,
} as const

/** The folders the cross-engine files are in. */
export const CROSS_ENGINE_LINTED_DIRS = ['src', 'dist', 'legacy', 'generated']

/** A folder named legacy at the root and in src, which an ignore ending in a slash tells apart by engine, and a file beside them. */
export const trailingSlashSourceFiles = {
  'src/a.ts': ARRAY_TYPE_SOURCE,
  'legacy/a.ts': ARRAY_TYPE_SOURCE,
  'src/legacy/a.ts': ARRAY_TYPE_SOURCE,
} as const

/** The folders the trailing-slash files are in. */
export const TRAILING_SLASH_LINTED_DIRS = ['src', 'legacy']

// typescript/array-type under array-simple (1); eqeqeq under always (2); no-warning-comments under
// its default terms (3).
const ARRAY_TYPE_AND_LOOSE_EQUALITY_SOURCE = `export const list: Array<string> = []
export const same = (a: number, b: number): boolean => a == b
// todo: remove this
`

/** Files a lib/** ignore and a negated line taking lib/a.ts back tell apart: one at the root, one in src, two in lib. */
export const negatedIgnoresSourceFiles = {
  'a.ts': ARRAY_TYPE_AND_LOOSE_EQUALITY_SOURCE,
  'src/a.ts': ARRAY_TYPE_AND_LOOSE_EQUALITY_SOURCE,
  'lib/a.ts': ARRAY_TYPE_AND_LOOSE_EQUALITY_SOURCE,
  'lib/b.ts': ARRAY_TYPE_AND_LOOSE_EQUALITY_SOURCE,
} as const

/** The paths of the negated-ignores files, the root file by name, so oxlint lints no config file written beside it. */
export const NEGATED_IGNORES_LINTED_PATHS = ['a.ts', 'src', 'lib']

/**
 * Files an entry of ours for lib/** and max-lines' own files (.tsx and .jsx but tests) tell apart:
 * a .tsx file, a test .tsx file and a .ts file in lib, and a .tsx and a .ts file in src. Each has a
 * second line, so a max-lines of 1 reports it.
 */
export const maxLinesSourceFiles = {
  'src/f.tsx': ARRAY_TYPE_TSX_SOURCE,
  'src/a.ts': ARRAY_TYPE_SOURCE,
  'lib/m.tsx': ARRAY_TYPE_TSX_SOURCE,
  'lib/m.test.tsx': ARRAY_TYPE_TSX_SOURCE,
  'lib/b.ts': ARRAY_TYPE_SOURCE,
} as const

/** The folders the max-lines files are in. */
export const MAX_LINES_LINTED_DIRS = ['src', 'lib']
