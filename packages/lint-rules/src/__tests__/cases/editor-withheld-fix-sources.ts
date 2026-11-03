import { moduleText } from '../factories/check-factories.ts'
import { CODE_A_WITHHELD_FIX_WOULD_BREAK } from './accepted-1011-check-sources.ts'
import { ATTEMPT_CATCHING, NAMED_IMPORTS_OUT_OF_ORDER, NAMED_IMPORTS_SORTED, UNITS, WRAP, WRAP_FIXED } from './check-sources.ts'
import { TESTS_A_JEST_DOM_FIX_BREAKS } from './jest-dom-sources.ts'
import { CODE_A_KEPT_FIX_REWRITES } from './jsdom-fix-check-sources.ts'
import { CLASS_LIST } from './routed-to-eslint-check-sources.ts'
import { PLAYWRIGHT_TESTS_REPORTED } from './rules-shipped-off.ts'
import { FILES_A_WITHHELD_FIX_WOULD_REWRITE } from './tanstack-zod-check-sources.ts'

// Two projects, as the ordering ruleset sorts JSX props and the react ruleset makes props read-only: in one project
// with the jest-dom and TanStack files, a fix-on-save would rewrite those lines too.

type ReportedFile = { readonly file: string; readonly source: string; readonly line: number; readonly rule: string }

type FixedFile = { readonly file: string; readonly source: string; readonly fixed: string }

/** Every file a withheld fix would rewrite outside the ordering and react rulesets, under the rule that reports it. */
export const FILES_A_WITHHELD_FIX_WOULD_CHANGE: readonly ReportedFile[] = [
  ...CODE_A_WITHHELD_FIX_WOULD_BREAK,
  ...FILES_A_WITHHELD_FIX_WOULD_REWRITE,
  ...TESTS_A_JEST_DOM_FIX_BREAKS,
  { file: 'src/attempt.ts', source: moduleText(...ATTEMPT_CATCHING), line: 4, rule: 'unicorn/prefer-optional-catch-binding' },
  { file: CLASS_LIST.file, source: CLASS_LIST.source, line: 3, rule: 'unicorn/prefer-single-call' },
]

/** The Playwright test whose web-first fix check withholds, the one shipped-off rule with a fix. */
export const PLAYWRIGHT_TESTS_A_WITHHELD_FIX_WOULD_CHANGE: readonly ReportedFile[] = PLAYWRIGHT_TESTS_REPORTED.filter(
  ({ rule }) => rule === 'playwright/prefer-web-first-assertions',
)

export const FILES_A_WITHHELD_RULE_SUGGESTS_A_REWRITE_IN: readonly ReportedFile[] = [
  {
    file: 'src/mark-next.ts',
    source: moduleText('export function mark(element: Element, nextClass: () => string) {', "  element.classList.add('first')", '  element.classList.add(nextClass())', '}'),
    line: 3,
    rule: 'unicorn/prefer-single-call',
  },
  {
    file: 'src/one-invoice.test.tsx',
    source: moduleText(
      "import { render, screen } from '@testing-library/react'",
      "import { expect, it } from 'vitest'",
      "import '@testing-library/jest-dom/vitest'",
      '',
      "it('lists one invoice', () => {",
      '  render(<ul><li>March</li></ul>)',
      '',
      "  expect(screen.getByRole('listitem')).toHaveLength(1)",
      '})',
    ),
    line: 8,
    rule: 'jest-dom/prefer-in-document',
  },
]

/** unicorn/prefer-array-some, ESLint, on line 2, suggests a rewrite: its fix is not withheld. */
export const A_REWRITE_SUGGESTED_BESIDE: ReportedFile = {
  file: 'src/has-big.ts',
  source: moduleText('export function hasBig(sizes: readonly number[]) {', '  return sizes.find((size) => size > 9) ? 1 : 0', '}'),
  line: 2,
  rule: 'unicorn/prefer-array-some',
}

/** Every file a withheld fix of the ordering or react ruleset would rewrite: each fix rewrites the line reported. */
export const FILES_A_WITHHELD_SORTING_OR_REACT_FIX_WOULD_CHANGE: readonly ReportedFile[] = [
  {
    file: 'src/theme-context.ts',
    source: moduleText("import { createContext } from 'react'", '', "export const ThemeContext = createContext('light')"),
    line: 3,
    rule: '@eslint-react/x-no-missing-context-display-name',
  },
  { file: 'src/units.ts', source: moduleText(...UNITS), line: 1, rule: 'perfectionist/sort-arrays' },
  {
    file: 'src/size-names.ts',
    source: moduleText("export const SIZE_NAMES = new Map([['small', 'S'], ['large', 'L']])"),
    line: 1,
    rule: 'perfectionist/sort-maps',
  },
  { file: 'src/size-limits.ts', source: moduleText('export const SIZE_LIMITS = { small: 1, large: 9 }'), line: 1, rule: 'perfectionist/sort-objects' },
  { file: 'src/size-order.ts', source: moduleText("export const SIZE_ORDER = new Set(['small', 'large'])"), line: 1, rule: 'perfectionist/sort-sets' },
]

/** object-shorthand and no-useless-rename, oxlint beside oxlint and ESLint without it, each on line 2: neither fix is withheld. */
export const FILES_FIXED_BESIDE: readonly FixedFile[] = [
  { file: 'src/wrap.ts', source: moduleText(...WRAP), fixed: moduleText(...WRAP_FIXED) },
  {
    file: 'src/rename.ts',
    source: moduleText('export function sizeOf(box: { size: number }) {', '  const { size: size } = box', '  return size', '}'),
    fixed: moduleText('export function sizeOf(box: { size: number }) {', '  const { size } = box', '  return size', '}'),
  },
]

/** The browser, modern-js and redundancy fixes the owner kept: none is withheld. */
export const FILES_FIXED_BESIDE_BROWSER: readonly FixedFile[] = CODE_A_KEPT_FIX_REWRITES

/** perfectionist/sort-named-imports, ESLint, on line 1: a fix of the plugin whose sorting fixes are withheld is not. */
export const FILES_FIXED_BESIDE_SORTING: readonly FixedFile[] = [
  { file: 'src/nested.ts', source: moduleText(...NAMED_IMPORTS_OUT_OF_ORDER), fixed: moduleText(...NAMED_IMPORTS_SORTED) },
]
