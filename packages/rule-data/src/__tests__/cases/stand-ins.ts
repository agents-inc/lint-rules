import type { CaseFile } from '../rule-case-runs.ts'

// Code each oxlint rule ESLint stands in for must draw from both, and code both must leave: run on both
// engines by changed-settings.integration.test.ts, and by lint-rules through its builds.

/** An oxlint rule ESLint has no version of, and the code its ESLint stand-in must report as it does. */
export type StandInCase = {
  readonly oxlintRule: string
  readonly silentIn: readonly CaseFile[]
  readonly reportedIn: readonly CaseFile[]
}

/** The oxlint rules ESLint stands in for without oxlint: code both must report, and code both must leave. */
export const STAND_IN_CASES: readonly StandInCase[] = [
  // unicorn's rule reports only where the receiver is proven a string; oxc's reports any receiver.
  {
    oxlintRule: 'oxc/bad-char-at-comparison',
    silentIn: [{ path: 'src/one-character.js', source: "export const isA = (value) => String(value).charAt(0) === 'a'\n" }],
    reportedIn: [{ path: 'src/two-characters.js', source: "export const isAb = (value) => String(value).charAt(0) === 'ab'\n" }],
  },
  {
    oxlintRule: 'oxc/bad-comparison-sequence',
    silentIn: [{ path: 'src/joined.js', source: 'export const between = (a, b, c) => a < b && b < c\n' }],
    reportedIn: [{ path: 'src/chained.js', source: 'export const between = (a, b, c) => a < b < c\n' }],
  },
  {
    oxlintRule: 'oxc/double-comparisons',
    silentIn: [{ path: 'src/single.js', source: 'export const atMost = (x, y) => x <= y\n' }],
    reportedIn: [{ path: 'src/double.js', source: 'export const atMost = (x, y) => x === y || x < y\n' }],
  },
  {
    oxlintRule: 'oxc/erasing-op',
    silentIn: [{ path: 'src/identity.js', source: 'export const same = (x) => x * 1\n' }],
    reportedIn: [{ path: 'src/erasing.js', source: 'export const zero = (x) => x * 0\n' }],
  },
  {
    oxlintRule: 'oxc/misrefactored-assign-op',
    silentIn: [{ path: 'src/added.js', source: 'export function grow(total, step) {\n  total += step\n  return total\n}\n' }],
    reportedIn: [{ path: 'src/misrefactored.js', source: 'export function grow(total, step) {\n  total += total + step\n  return total\n}\n' }],
  },
  // sonarjs's reports the other built-in errors too (new TypeError(…)); oxc's only Error.
  {
    oxlintRule: 'oxc/missing-throw',
    silentIn: [
      { path: 'src/thrown.js', source: "export function fail() {\n  throw new Error('failed')\n}\n" },
      { path: 'src/returned.js', source: "export function failure() {\n  return new Error('failed')\n}\n" },
    ],
    reportedIn: [{ path: 'src/created.js', source: "export function fail() {\n  new Error('failed')\n}\n" }],
  },
]
