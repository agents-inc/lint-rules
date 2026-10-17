// Code each oxc rule with an ESLint stand-in reports, by the oxc rule's ID; the catalog names the stand-in.

/** An oxlint-only rule, and code it and its stand-in both report (measured, oxlint 1.87 and unicorn 77). */
export type StandInFixture = { readonly oxlintRule: string; readonly fixture: string }

export const STAND_IN_FIXTURES: readonly StandInFixture[] = [
  // unicorn's reports only a receiver it can prove is a string: silent on `s.charAt(0) === 'ab'` with `s` a parameter (measured, unicorn 77).
  { oxlintRule: 'oxc/bad-char-at-comparison', fixture: "const word = 'abc'\nexport const isA = word.charAt(0) === 'ab'\n" },
  { oxlintRule: 'oxc/bad-comparison-sequence', fixture: 'export const inOrder = (a, b, c) => a < b < c\n' },
  // unicorn's is silent on `x == y || x < y`, the gate's own fixture.
  { oxlintRule: 'oxc/double-comparisons', fixture: 'export const atMost = (x, y) => x === y || x < y\n' },
  { oxlintRule: 'oxc/erasing-op', fixture: 'export const erased = (x) => x * 0\n' },
  { oxlintRule: 'oxc/misrefactored-assign-op', fixture: 'export function grow(t, n) {\n  t += t + n\n  return t\n}\n' },
]
