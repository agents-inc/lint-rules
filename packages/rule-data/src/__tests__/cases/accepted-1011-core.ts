import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// The core rules oxlint runs that the owner accepted on the old candidates page on 2026-10-11: each reports the page's
// code and stays silent on its corrected form, and on a shape its docs say it leaves alone. A .js copy of each report
// case is there for ESLint's version, which runs the rule without oxlint (typescript-eslint's no-array-constructor on
// TS files in its place).

// no-useless-assignment ships though sonarjs/no-dead-store reports some of its lines too. no-new-wrappers' fix is
// withheld: oxlint's deletes `new`, and `new Boolean(false)` stops being truthy.

/** The ruleset the candidates page proposed for each core rule oxlint runs that the owner accepted on 2026-10-11. */
export const ACCEPTED_1011_CORE_RULESETS: Readonly<Record<string, string>> = {
  'accessor-pairs': 'correctness',
  'no-array-constructor': 'correctness',
  'no-empty': 'correctness',
  'no-new-wrappers': 'correctness',
  'no-object-constructor': 'modern-js',
  'no-self-compare': 'correctness',
  'no-sequences': 'correctness',
  'no-useless-assignment': 'redundancy',
  'prefer-object-has-own': 'modern-js',
  'radix': 'correctness',
  'symbol-description': 'conventions',
}

/** The rules the page proposed shipping outside test files, where test doubles stub write-only setters. */
export const ACCEPTED_1011_CORE_RULES_SKIPPING_TEST_FILES: readonly string[] = ['accessor-pairs']

const SETTER_ONLY = `export const preferences = {
  set theme(value: string) {
    localStorage.setItem('theme', value)
  },
}
`

const EMPTY_CATCH = `export function parseSettings(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {}
}
`

/** Each shipped accepted core rule's report case beside its silent twin. */
export const ACCEPTED_1011_CORE_CASES: readonly RuleCase[] = [
  {
    rule: 'accessor-pairs',
    silentIn: [
      {
        path: 'src/getter-and-setter.ts',
        source: `export const preferences = {
  get theme() {
    return localStorage.getItem('theme') ?? 'light'
  },
  set theme(value: string) {
    localStorage.setItem('theme', value)
  },
}
`,
      },
      {
        path: 'src/getter-only.ts',
        source: `export const preferences = {
  get theme() {
    return localStorage.getItem('theme')
  },
}
`,
      },
      { path: 'src/setter-only.test.ts', source: SETTER_ONLY },
      {
        path: 'src/__tests__/canvas-stub.ts',
        source: `export const context = {
  set fillStyle(value: string) {},
  set font(value: string) {},
}
`,
      },
    ],
    reportedIn: [
      { path: 'src/setter-only.ts', source: SETTER_ONLY },
      {
        path: 'src/setter-only.js',
        source: `export const preferences = {
  set theme(value) {
    localStorage.setItem('theme', value)
  },
}
`,
      },
      {
        path: 'src/setter-only-class.ts',
        source: `export class Preferences {
  set theme(value: string) {
    localStorage.setItem('theme', value)
  }
}
`,
      },
    ],
  },
  // typescript-eslint's version, which ESLint runs on TS files without oxlint, and oxlint's both leave a typed call alone.
  {
    rule: 'no-array-constructor',
    silentIn: [
      { path: 'src/literal-sizes.ts', source: 'export const sizes = [8, 16, 24]\n' },
      { path: 'src/sized.ts', source: 'export const slots = (size: number) => new Array(size)\n' },
      { path: 'src/typed-pair.ts', source: "export const pair = new Array<string>('left', 'right')\n" },
    ],
    reportedIn: [
      { path: 'src/sizes.ts', source: 'export const sizes = new Array(8, 16, 24)\n' },
      { path: 'src/sizes.js', source: 'export const sizes = new Array(8, 16, 24)\n' },
      { path: 'src/called-sizes.ts', source: 'export const sizes = Array(8, 16, 24)\n' },
    ],
  },
  // A comment inside the block says why it is empty; a function body is no-empty-function's.
  {
    rule: 'no-empty',
    silentIn: [
      {
        path: 'src/rethrown.ts',
        source: `export function parseSettings(raw: string) {
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error('Settings are not valid JSON', { cause: error })
  }
}
`,
      },
      {
        path: 'src/commented-catch.ts',
        source: `export function parseSettings(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    // Settings that do not parse stay at their defaults.
  }
}
`,
      },
      { path: 'src/noop.ts', source: 'export function noop() {}\n' },
    ],
    reportedIn: [
      { path: 'src/empty-catch.ts', source: EMPTY_CATCH },
      {
        path: 'src/empty-catch.js',
        source: `export function parseSettings(raw) {
  try {
    return JSON.parse(raw)
  } catch {}
}
`,
      },
    ],
  },
  {
    rule: 'no-self-compare',
    silentIn: [
      { path: 'src/is-nan.ts', source: "export const describe = (value: number) => (Number.isNaN(value) ? 'invalid' : String(value))\n" },
      { path: 'src/changed.ts', source: 'export const changed = (before: number, after: number) => before !== after\n' },
    ],
    reportedIn: [
      { path: 'src/self-compare.ts', source: "export const describe = (value: number) => (value !== value ? 'invalid' : String(value))\n" },
      { path: 'src/self-compare.js', source: "export const describe = (value) => (value !== value ? 'invalid' : String(value))\n" },
    ],
  },
  // The comma in a for loop's update is allowed.
  {
    rule: 'no-sequences',
    silentIn: [
      {
        path: 'src/summed.ts',
        source: `export function bump(total: number, step: number) {
  return total + step
}
`,
      },
      {
        path: 'src/two-ended-loop.ts',
        source: `export function stepsToMeet(from: number) {
  let steps = 0
  for (let left = 0, right = from; left < right; left += 1, right -= 1) steps += 1
  return steps
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/comma-return.ts',
        source: `export function bump(total: number, step: number) {
  return (total += step), total
}
`,
      },
      {
        path: 'src/comma-return.js',
        source: `export function bump(total, step) {
  return (total += step), total
}
`,
      },
      {
        path: 'src/comma-statement.js',
        source: `export function restart(player) {
  player.stop(), player.start()
}
`,
      },
    ],
  },
  // parseFloat takes no radix.
  {
    rule: 'radix',
    silentIn: [
      { path: 'src/decimal-page.ts', source: 'export const toPage = (value: string) => parseInt(value, 10)\n' },
      { path: 'src/ratio.ts', source: 'export const toRatio = (value: string) => parseFloat(value)\n' },
    ],
    reportedIn: [
      { path: 'src/page.ts', source: 'export const toPage = (value: string) => parseInt(value)\n' },
      { path: 'src/page.js', source: 'export const toPage = (value) => parseInt(value)\n' },
    ],
  },
  // Object given an argument converts it rather than making an empty object.
  {
    rule: 'no-object-constructor',
    silentIn: [
      { path: 'src/literal-headers.ts', source: 'export const createHeaders = () => ({})\n' },
      { path: 'src/boxed.ts', source: 'export const box = (value: unknown) => Object(value)\n' },
    ],
    reportedIn: [
      { path: 'src/object-headers.ts', source: 'export const createHeaders = () => new Object()\n' },
      { path: 'src/object-headers.js', source: 'export const createHeaders = () => new Object()\n' },
    ],
  },
  // A hasOwnProperty called on the object itself is no-prototype-builtins'.
  {
    rule: 'prefer-object-has-own',
    silentIn: [
      { path: 'src/has-own.ts', source: "export const hasTheme = (config: object) => Object.hasOwn(config, 'theme')\n" },
      {
        path: 'src/own-method.ts',
        source: "export const hasTheme = (config: { hasOwnProperty(key: string): boolean }) => config.hasOwnProperty('theme')\n",
      },
    ],
    reportedIn: [
      { path: 'src/prototype-call.ts', source: "export const hasTheme = (config: object) => Object.prototype.hasOwnProperty.call(config, 'theme')\n" },
      { path: 'src/prototype-call.js', source: "export const hasTheme = (config) => Object.prototype.hasOwnProperty.call(config, 'theme')\n" },
      { path: 'src/literal-call.ts', source: "export const hasTheme = (config: object) => ({}).hasOwnProperty.call(config, 'theme')\n" },
    ],
  },
  {
    rule: 'symbol-description',
    silentIn: [
      { path: 'src/described-symbol.ts', source: "export const authToken = Symbol('auth token')\n" },
      { path: 'src/registered-symbol.ts', source: "export const authToken = Symbol.for('auth token')\n" },
    ],
    reportedIn: [
      { path: 'src/bare-symbol.ts', source: 'export const authToken = Symbol()\n' },
      { path: 'src/bare-symbol.js', source: 'export const authToken = Symbol()\n' },
    ],
  },
  {
    rule: 'no-new-wrappers',
    silentIn: [
      { path: 'src/string-id.ts', source: 'export const toId = (raw: number) => String(raw)\n' },
      { path: 'src/number-count.ts', source: 'export const toCount = (raw: string) => Number(raw)\n' },
    ],
    reportedIn: [
      { path: 'src/wrapped-id.ts', source: 'export const toId = (raw: number) => new String(raw)\n' },
      { path: 'src/wrapped-id.js', source: 'export const toId = (raw) => new String(raw)\n' },
      {
        path: 'src/wrapped-flag.ts',
        source: `export function featureLabel(raw: string) {
  const enabled = new Boolean(raw === 'yes')
  return enabled ? 'on' : 'off'
}
`,
      },
    ],
  },
  // An initial value read on the path that skips the reassignment is used.
  {
    rule: 'no-useless-assignment',
    silentIn: [
      {
        path: 'src/const-label.ts',
        source: `export function label(count: number) {
  const text = count === 1 ? 'one item' : \`\${count} items\`
  return text
}
`,
      },
      {
        path: 'src/read-on-one-path.ts',
        source: `export function label(count: number) {
  let text = 'none'
  if (count > 0) text = \`\${count} items\`
  return text
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/dead-initial-value.ts',
        source: `export function label(count: number) {
  let text = 'none'
  text = count === 1 ? 'one item' : \`\${count} items\`
  return text
}
`,
      },
      {
        path: 'src/dead-initial-value.js',
        source: `export function label(count) {
  let text = 'none'
  text = count === 1 ? 'one item' : \`\${count} items\`
  return text
}
`,
      },
      {
        path: 'src/overwritten-call.ts',
        source: `export function latest(read: () => string, reread: () => string) {
  let text = read()
  text = reread()
  return text
}
`,
      },
    ],
  },
]

/**
 * The cases of accepted core rules whose measurement tripped the spec's stop, unrun until the owner answers the card
 * each waits on: once the rule ships, its case moves to ACCEPTED_1011_CORE_CASES.
 */
export const ACCEPTED_1011_CORE_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = []
