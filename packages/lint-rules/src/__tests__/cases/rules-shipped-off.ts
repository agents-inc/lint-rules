import { moduleText } from '../factories/check-factories.ts'
import { AN_HTML_READ, HTML_READ_SOURCE_FILE } from './html-read-sources.ts'
import { A_LOCATION_WRITE } from './jsdom-fix-check-sources.ts'

// The accepted rules we ship off by default: our rules list accepts each, none runs anywhere until a team names it, and
// one named runs wherever the team turns it on. Each source below was run through ESLint with its one rule on, to find
// the line it reports and the rewrite its plugin offers there (eslint-plugin-playwright 2.12.1, eslint-plugin-unicorn
// 78.0.0, @e18e/eslint-plugin 0.8.1).

/** The four that report the same line as a shipped vitest rule in Vitest and Jest test files, and web-first, whose fix check withholds. */
export const PLAYWRIGHT_RULES_SHIPPED_OFF = [
  'playwright/no-focused-test',
  'playwright/no-identical-title',
  'playwright/prefer-hooks-on-top',
  'playwright/prefer-web-first-assertions',
  'playwright/require-to-throw-message',
] as const

/** Newest-language rules whose only rewrite is a suggestion, which check never applies. */
export const NEWEST_LANGUAGE_RULES_SHIPPED_OFF = ['unicorn/prefer-dispose', 'unicorn/prefer-iterator-zip'] as const

/** Rules whose automatic fix writes an API Node 22 lacks, or one jsdom or a test's stand-in location lacks: check and editors withhold it. */
export const RULES_SHIPPED_OFF_WITH_THEIR_FIX_WITHHELD = [
  'e18e/prefer-get-or-insert',
  'unicorn/prefer-dom-node-html-methods',
  'unicorn/prefer-error-is-error',
  'unicorn/prefer-get-or-insert-computed',
  'unicorn/prefer-iterator-concat',
  'unicorn/prefer-location-assign',
  'unicorn/prefer-promise-try',
  'unicorn/prefer-regexp-escape',
  'unicorn/prefer-temporal',
  'unicorn/prefer-uint8array-base64',
  'unicorn/prefer-uint8array-hex',
] as const

export const RULES_SHIPPED_OFF = [...PLAYWRIGHT_RULES_SHIPPED_OFF, ...NEWEST_LANGUAGE_RULES_SHIPPED_OFF, ...RULES_SHIPPED_OFF_WITH_THEIR_FIX_WITHHELD] as const

/** A Playwright rule nobody accepted: still one we do not ship. */
export const PLAYWRIGHT_RULE_NOT_ACCEPTED = 'playwright/no-skipped-test'

/** Recommended by a sweep, never accepted by the owner: still one we do not ship. */
export const RULE_RECOMMENDED_NOT_ACCEPTED = 'no-case-declarations'

/** Where a team keeps its Playwright tests, as the example init writes names them. */
export const PLAYWRIGHT_TESTS = ['e2e/**'] as const

/** A Playwright test, a Vitest test and a source file: the three kinds of file a shipped-off rule is judged in. */
export const FILES_JUDGED = { playwrightTest: 'e2e/home.spec.ts', unitTest: 'src/menu.test.ts', source: 'src/menu.ts' } as const

/** A file, the line check reports it on, and the rule that reports it there. */
type ReportedFile = { readonly file: string; readonly source: string; readonly line: number; readonly rule: string }

const IMPORTS_PLAYWRIGHT = "import { expect, test } from '@playwright/test'\n\n"

/**
 * Each Playwright test a shipped-off Playwright rule reports, in path order as check prints their findings. They locate
 * by CSS, since the testing-library ruleset init lists reports page.getByRole in a spec file.
 */
export const PLAYWRIGHT_TESTS_REPORTED: readonly ReportedFile[] = [
  {
    file: 'e2e/focused.spec.ts',
    source: `${IMPORTS_PLAYWRIGHT}test.only('opens the menu', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('nav')).toBeVisible()
})
`,
    line: 3,
    rule: 'playwright/no-focused-test',
  },
  {
    file: 'e2e/hook-below-a-test.spec.ts',
    source: `${IMPORTS_PLAYWRIGHT}test('opens', async ({ page }) => {
  await expect(page.locator('nav')).toBeVisible()
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})
`,
    line: 7,
    rule: 'playwright/prefer-hooks-on-top',
  },
  {
    file: 'e2e/identical-titles.spec.ts',
    source: `${IMPORTS_PLAYWRIGHT}test('opens', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('nav')).toBeVisible()
})

test('opens', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.locator('nav')).toBeVisible()
})
`,
    line: 8,
    rule: 'playwright/no-identical-title',
  },
  // Its fix would write await expect(page.locator('.tooltip')).toBeHidden(); check withholds it.
  {
    file: 'e2e/is-visible.spec.ts',
    source: `${IMPORTS_PLAYWRIGHT}test('hides the tooltip', async ({ page }) => {
  await page.goto('/')
  expect(await page.locator('.tooltip').isVisible()).toBe(false)
})
`,
    line: 5,
    rule: 'playwright/prefer-web-first-assertions',
  },
  {
    file: 'e2e/throws.spec.ts',
    source: `${IMPORTS_PLAYWRIGHT}test('refuses an empty title', () => {
  expect(() => {
    throw new Error('empty title')
  }).toThrow()
})
`,
    line: 6,
    rule: 'playwright/require-to-throw-message',
  },
]

/** Each source file a shipped-off newest-language rule reports, in path order; its suggestion would write `Iterator.zip` or `using`. */
export const SOURCES_REPORTED: readonly ReportedFile[] = [
  {
    file: 'src/labelled.ts',
    source: `export function labelled(names: readonly string[], ages: readonly number[]): string[] {
  const labels: string[] = []
  for (let index = 0; index < Math.min(names.length, ages.length); index++) {
    labels.push(\`\${names[index]}: \${ages[index]}\`)
  }
  return labels
}
`,
    line: 3,
    rule: 'unicorn/prefer-iterator-zip',
  },
  {
    file: 'src/read-first-line.ts',
    source: `declare function openFile(path: string): { readLine(): string; close(): void }

export function readFirstLine(path: string): string {
  const file = openFile(path)
  try {
    return file.readLine()
  } finally {
    file.close()
  }
}
`,
    line: 5,
    rule: 'unicorn/prefer-dispose',
  },
]

/** Each source file a rule of RULES_SHIPPED_OFF_WITH_THEIR_FIX_WITHHELD reports, its plugin as shipped offering a fix there, in path order. */
export const SOURCES_A_WITHHELD_FIX_WOULD_CHANGE: readonly ReportedFile[] = [
  {
    file: 'src/base64-url.ts',
    source: moduleText("export const base64UrlOf = (bytes: Uint8Array): string => bytes.toBase64().replaceAll('+', '-').replaceAll('/', '_')"),
    line: 1,
    rule: 'unicorn/prefer-uint8array-base64',
  },
  {
    file: 'src/both.ts',
    source: moduleText('export const both = (first: Iterable<string>, second: Iterable<string>): Set<string> => new Set([...first, ...second])'),
    line: 1,
    rule: 'unicorn/prefer-iterator-concat',
  },
  {
    file: 'src/count.ts',
    source: moduleText('export function countOf(counts: Map<string, number>, word: string): number {', '  const count = counts.get(word) ?? 0', '  counts.set(word, count)', '  return count', '}'),
    line: 2,
    rule: 'e18e/prefer-get-or-insert',
  },
  {
    file: 'src/escaped.ts',
    source: moduleText(String.raw`export const escaped = (text: string): string => text.replace(/[$()*+.?[\\\]^{|}]/gu, '\\$&')`),
    line: 1,
    rule: 'unicorn/prefer-regexp-escape',
  },
  { ...A_LOCATION_WRITE, line: 2, rule: 'unicorn/prefer-location-assign' },
  { file: 'src/hex.ts', source: moduleText("export const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex')"), line: 1, rule: 'unicorn/prefer-uint8array-hex' },
  { file: 'src/is-error.ts', source: moduleText('export const isError = (value: unknown): boolean => value instanceof Error'), line: 1, rule: 'unicorn/prefer-error-is-error' },
  {
    file: 'src/length.ts',
    source: moduleText('export const lengthOf = (lengths: Map<string, number>, word: string): number => lengths.getOrInsert(word, word.trim().length)'),
    line: 1,
    rule: 'unicorn/prefer-get-or-insert-computed',
  },
  { file: HTML_READ_SOURCE_FILE, source: moduleText(AN_HTML_READ), line: 1, rule: 'unicorn/prefer-dom-node-html-methods' },
  {
    file: 'src/try-read.ts',
    source: moduleText('export const tryRead = (read: () => number): Promise<number> => new Promise((resolve) => resolve(read()))'),
    line: 1,
    rule: 'unicorn/prefer-promise-try',
  },
]

/** prefer-temporal reports a new Date() with no fix, its plugin suggesting a Temporal rewrite. */
export const SOURCE_A_WITHHELD_SUGGESTION_WOULD_CHANGE: ReportedFile = {
  file: 'src/now.ts',
  source: moduleText('export const now = (): Date => new Date()'),
  line: 1,
  rule: 'unicorn/prefer-temporal',
}

/**
 * A Vitest test outside the Playwright folder holding what three of the Playwright rules report: a focused test, a
 * repeated title, a toThrow() without a message. They run on the Playwright tests alone, so it stays unreported.
 */
export const UNIT_TEST_OUTSIDE_THE_PLAYWRIGHT_FOLDER = {
  file: 'src/title.test.ts',
  source: `import { expect, it } from 'vitest'

it.only('refuses an empty title', () => {
  expect(() => {
    throw new Error('empty title')
  }).toThrow()
})

it('refuses an empty title', () => {
  expect(() => {
    throw new Error('empty title')
  }).toThrow()
})
`,
} as const
