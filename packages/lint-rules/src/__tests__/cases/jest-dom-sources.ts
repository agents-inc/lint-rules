import { ACCEPTED_JEST_DOM_CASES } from '@workspace/rule-data/test-support/accepted-jd-cases'

// The tests of rule-data's accepted-jd.ts that a jest-dom fix breaks: each passes as written and fails once fixed, on
// jest-dom 6.9.1 with Vitest 5.0.5 (measured), so check withholds the fix. Each source and rule is read from that file;
// only the line check reports it on is written here.

const TEST_WITH_JEST_DOM = `import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

`

type ReportedTest = { readonly file: string; readonly source: string; readonly line: number; readonly rule: string }

export const LINES_OF_THE_FINDINGS = [
  { file: 'src/active-tab-css-module.test.tsx', line: 10 },
  { file: 'src/all-invoices-truthy.test.tsx', line: 13 },
  { file: 'src/dark-mode-switch-presence.test.tsx', line: 8 },
  { file: 'src/detached-row-truthy.test.tsx', line: 13 },
  { file: 'src/email-aria-required-presence.test.tsx', line: 8 },
  { file: 'src/fragment-first-child-null.test.tsx', line: 10 },
  { file: 'src/italic-toggle-presence.test.tsx', line: 8 },
  { file: 'src/parsed-link-rel.test.jsx', line: 9 },
] as const

const REPORTED_JEST_DOM_TESTS = ACCEPTED_JEST_DOM_CASES.flatMap(({ rule, reportedIn }) => reportedIn.map(({ path, source }) => ({ file: path, source, rule })))

/**
 * In path order, as check prints their findings. Built while the test file loads, which must not throw, so a path with
 * no reported case in rule-data is left out here, and jest-dom-sources.test.ts fails naming it.
 */
export const TESTS_A_JEST_DOM_FIX_BREAKS: readonly ReportedTest[] = LINES_OF_THE_FINDINGS.flatMap(({ file, line }) =>
  REPORTED_JEST_DOM_TESTS.filter((reported) => reported.file === file).map(({ source, rule }) => ({ file, source, line, rule })),
)

/** A query by a regular expression with the global flag, which testing-library/no-global-regexp-flag-in-query reports and fixes; jest-dom reports nothing in it. */
export const A_GLOBAL_FLAG_QUERY = {
  file: 'src/save-button.test.tsx',
  source: `${TEST_WITH_JEST_DOM}it('offers to save', () => {
  render(<button type="button">Save</button>)

  expect(screen.getByText(/save/giu)).toBeVisible()
})
`,
  fixed: `${TEST_WITH_JEST_DOM}it('offers to save', () => {
  render(<button type="button">Save</button>)

  expect(screen.getByText(/save/iu)).toBeVisible()
})
`,
} as const
