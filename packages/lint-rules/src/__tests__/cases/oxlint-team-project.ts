// A team project linted by the real oxlint CLI with the team's config alone and merged with our
// oxlint part. Each source line draws one rule, noted beside it.

export const LINTED_DIR = 'src'

export const sourceFiles = {
  // no-debugger (line 1); typescript/no-inferrable-types (2); eqeqeq under always, not smart (3)
  'src/a.ts': `debugger
export const count: number = 1
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
  // react/no-string-refs (1)
  'src/f.tsx': `export const List = () => <ul id="a" id="b"><li ref="item" /></ul>
`,
  // The same two react rules, in a file a team override for .tsx files does not match
  'src/g.jsx': `export const Other = () => <ul id="a" id="b"><li ref="item" /></ul>
`,
  // no-compare-neg-zero: a core rule, in oxlint's eslint scope, which its correctness category turns on
  'src/h.ts': `export const isNegativeZero = (value: number): boolean => value === -0
`,
} as const

/** src, and lib, which no override for src matches. */
export const REACT_LINTED_DIRS = ['src', 'lib']

// react/jsx-no-duplicate-props (via react's correctness category) and react/no-string-refs, both on line 1.
const REACT_SOURCE = `export const List = () => <ul id="a" id="b"><li ref="item" /></ul>
`

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

export const browserSourceFilesInTwoFolders = {
  'src/i.js': browserSourceFiles['src/i.js'],
  'lib/i.js': browserSourceFiles['src/i.js'],
} as const

export const BROWSER_LINTED_DIRS = ['src', 'lib']

// typescript/no-inferrable-types (1); react-hooks/rules-of-hooks, a hook called conditionally (2).
const INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE = `export const count: number = 1
export function useThing(on: boolean): void { if (on) useOther() }
`

/** Our ESLint part runs a rule here or not by our ignores (dist, generated), an entry (legacy), and rules-of-hooks' own ignores (test files). */
export const crossEngineSourceFiles = {
  'src/a.ts': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'dist/a.ts': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'legacy/a.ts': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'generated/a.ts': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'src/generated/a.ts': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'src/f.tsx': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'src/f.test.tsx': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
} as const

export const CROSS_ENGINE_LINTED_DIRS = ['src', 'dist', 'legacy', 'generated']

/** An ignore ending in a slash tells the root and src legacy folders apart by engine. */
export const trailingSlashSourceFiles = {
  'src/a.ts': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'legacy/a.ts': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'src/legacy/a.ts': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
} as const

export const TRAILING_SLASH_LINTED_DIRS = ['src', 'legacy']

// typescript/no-inferrable-types (1); eqeqeq under always (2); no-warning-comments under its default terms (3).
const INFERRABLE_TYPE_AND_LOOSE_EQUALITY_SOURCE = `export const count: number = 1
export const same = (a: number, b: number): boolean => a == b
// todo: remove this
`

/** Files a lib/** ignore and a negated line taking lib/a.ts back tell apart: one at the root, one in src, two in lib. */
export const negatedIgnoresSourceFiles = {
  'a.ts': INFERRABLE_TYPE_AND_LOOSE_EQUALITY_SOURCE,
  'src/a.ts': INFERRABLE_TYPE_AND_LOOSE_EQUALITY_SOURCE,
  'lib/a.ts': INFERRABLE_TYPE_AND_LOOSE_EQUALITY_SOURCE,
  'lib/b.ts': INFERRABLE_TYPE_AND_LOOSE_EQUALITY_SOURCE,
} as const

/** The root file by name, so oxlint lints no config file written beside it. */
export const NEGATED_IGNORES_LINTED_PATHS = ['a.ts', 'src', 'lib']

export const rulesOfHooksSourceFiles = {
  'src/f.tsx': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'src/a.ts': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'lib/m.tsx': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'lib/m.test.tsx': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
  'lib/b.ts': INFERRABLE_TYPE_AND_CONDITIONAL_HOOK_SOURCE,
} as const

export const RULES_OF_HOOKS_LINTED_DIRS = ['src', 'lib']
