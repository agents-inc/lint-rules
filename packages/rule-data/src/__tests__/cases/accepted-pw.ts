import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase, StubPackage } from './changed-settings.ts'

// The Playwright rules the owner accepted on 2026-10-24: each reports the card's test and stays silent on its
// corrected form, and on a shape its code or docs say it leaves alone. The plugin finds Playwright's test and expect
// by their names, not by the import, so no case installs @playwright/test.

const IMPORTS_PLAYWRIGHT = "import { test, expect } from '@playwright/test'\n\n"

/**
 * The shipped Playwright rules that run in test files only. They know Playwright's page by its name, not by its
 * import, so they report Puppeteer's page.$ and page.waitForSelector too (measured, eslint-plugin-playwright 2.12.1).
 * The owner's answer on card q-lint-rc-pw-puppeteer-page, "Only in test files": Puppeteer code outside the test files
 * is never reported, and neither is a Playwright helper outside them.
 */
export const PLAYWRIGHT_RULES_IN_TEST_FILES_ONLY: readonly string[] = ['playwright/no-element-handle', 'playwright/no-wait-for-selector']

/** Puppeteer's browser, page and element handle, as the source file below uses them. */
const PUPPETEER_CORE: StubPackage = {
  name: 'puppeteer-core',
  declarations: `export interface ElementHandle {
  evaluate<R>(read: (element: { readonly textContent: string | null }) => R): Promise<R>
}
export interface Page {
  goto(url: string): Promise<unknown>
  waitForSelector(selector: string): Promise<ElementHandle | null>
  $(selector: string): Promise<ElementHandle | null>
}
export interface Browser {
  newPage(): Promise<Page>
  close(): Promise<void>
}
declare const puppeteer: { launch(options: { readonly executablePath: string }): Promise<Browser> }
export default puppeteer
`,
}

/**
 * A source file outside the test files driving Puppeteer's page, whose waitForSelector and $ are Puppeteer's own API,
 * not Playwright's: the proof that the two rules kept to test files leave it unread.
 */
const PUPPETEER_READS_A_HEADLINE = {
  path: 'src/read-headline.ts',
  source: `import puppeteer from 'puppeteer-core'

export async function readHeadline(url: string, executablePath: string): Promise<string | null> {
  const browser = await puppeteer.launch({ executablePath })
  try {
    const page = await browser.newPage()
    await page.goto(url)
    await page.waitForSelector('h1')
    const heading = await page.$('h1')
    return heading === null ? null : await heading.evaluate((element) => element.textContent)
  } finally {
    await browser.close()
  }
}
`,
}

/** Each shipped accepted Playwright rule's report case beside its silent twin, in the order of their IDs. */
export const ACCEPTED_PLAYWRIGHT_CASES: readonly RuleCase[] = [
  // Each test has a timeout of its own, so one test.slow() in each of two tests multiplies neither.
  {
    rule: 'playwright/no-duplicate-slow',
    silentIn: [
      {
        path: 'e2e/one-slow-call.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('slow', async ({ page }) => {
  test.slow()
  await expect(page).toHaveTitle('Home')
})
`,
      },
      {
        path: 'e2e/slow-in-two-tests.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('loads the report', async ({ page }) => {
  test.slow()
  await expect(page).toHaveTitle('Report')
})

test('loads the archive', async ({ page }) => {
  test.slow()
  await expect(page).toHaveTitle('Archive')
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'e2e/two-slow-calls.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('slow', async ({ page }) => {
  test.slow()
  test.slow()
  await expect(page).toHaveTitle('Home')
})
`,
      },
    ],
  },
  // A $ that is not a page's or a frame's, such as cheerio's over the page's HTML, returns no element handle, and
  // outside the test files Puppeteer's page.$ goes unread.
  {
    rule: 'playwright/no-element-handle',
    silentIn: [
      {
        path: 'e2e/locator.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('reads', async ({ page }) => {
  await expect(page.locator('.title')).toHaveText('Home')
})
`,
      },
      {
        path: 'e2e/cheerio-over-page-html.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}declare function load(html: string): (selector: string) => { readonly text: () => string }

test('renders the title on the server', async ({ page }) => {
  const $ = load(await page.content())
  expect($('h1').text()).toBe('Home')
})
`,
      },
      PUPPETEER_READS_A_HEADLINE,
    ],
    reportedIn: [
      {
        path: 'e2e/page-dollar.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('reads', async ({ page }) => {
  const handle = await page.$('.title')
  await expect(page.getByText(String(await handle?.textContent()))).toBeVisible()
})
`,
      },
      {
        path: 'e2e/page-double-dollar.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('lists', async ({ page }) => {
  const items = await page.$$('li')
  expect(items).toHaveLength(3)
})
`,
      },
    ],
    packages: [PUPPETEER_CORE],
  },
  // Another load state is not networkidle.
  {
    rule: 'playwright/no-networkidle',
    silentIn: [
      {
        path: 'e2e/goto.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main')).toBeVisible()
})
`,
      },
      {
        path: 'e2e/dom-content-loaded.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('loads', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByRole('main')).toBeVisible()
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'e2e/goto-networkidle.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('loads', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.getByRole('main')).toBeVisible()
})
`,
      },
      {
        path: 'e2e/wait-for-networkidle.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('loads', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('main')).toBeVisible()
})
`,
      },
    ],
  },
  // A locator's own waitFor() is the wait the rule asks for, and outside the test files Puppeteer's
  // page.waitForSelector goes unread.
  {
    rule: 'playwright/no-wait-for-selector',
    silentIn: [
      {
        path: 'e2e/expect-visible.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('saves', async ({ page }) => {
  await expect(page.locator('.toast')).toBeVisible()
  await expect(page.getByText('Saved')).toBeVisible()
})
`,
      },
      {
        path: 'e2e/locator-wait-for.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('saves', async ({ page }) => {
  await page.locator('.toast').waitFor()
  await expect(page.getByText('Saved')).toBeVisible()
})
`,
      },
      PUPPETEER_READS_A_HEADLINE,
    ],
    reportedIn: [
      {
        path: 'e2e/wait-for-selector.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('saves', async ({ page }) => {
  await page.waitForSelector('.toast')
  await expect(page.getByText('Saved')).toBeVisible()
})
`,
      },
    ],
    packages: [PUPPETEER_CORE],
  },
  // Options that name a timeout satisfy it, whatever else they hold.
  {
    rule: 'playwright/require-to-pass-timeout',
    silentIn: [
      {
        path: 'e2e/to-pass-timeout.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('eventually', async ({ page }) => {
  await expect(async () => {
    expect(await page.title()).toBe('Home')
  }).toPass({ timeout: 10_000 })
})
`,
      },
      {
        path: 'e2e/to-pass-intervals-and-timeout.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('eventually', async ({ page }) => {
  await expect(async () => {
    expect(await page.title()).toBe('Home')
  }).toPass({ intervals: [1_000, 2_000], timeout: 10_000 })
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'e2e/to-pass.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('eventually', async ({ page }) => {
  await expect(async () => {
    expect(await page.title()).toBe('Home')
  }).toPass()
})
`,
      },
      {
        path: 'e2e/to-pass-intervals.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('eventually', async ({ page }) => {
  await expect(async () => {
    expect(await page.title()).toBe('Home')
  }).toPass({ intervals: [1_000, 2_000] })
})
`,
      },
    ],
  },
  // A tag in the title, or a list of tags, each starting with @, is valid too.
  {
    rule: 'playwright/valid-test-tags',
    silentIn: [
      {
        path: 'e2e/at-tag.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('opens', { tag: '@smoke' }, async ({ page }) => {
  await expect(page).toHaveTitle('Home')
})
`,
      },
      {
        path: 'e2e/title-and-list-tags.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('opens @smoke', async ({ page }) => {
  await expect(page).toHaveTitle('Home')
})

test('closes', { tag: ['@smoke', '@fast'] }, async ({ page }) => {
  await expect(page).toHaveTitle('Home')
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'e2e/bare-tag.spec.ts',
        source: `${IMPORTS_PLAYWRIGHT}test('opens', { tag: 'smoke' }, async ({ page }) => {
  await expect(page).toHaveTitle('Home')
})
`,
      },
    ],
  },
]

/**
 * The cases of accepted Playwright rules whose build waits on a card, unrun until the owner answers it: once the rule
 * ships, its case moves to ACCEPTED_PLAYWRIGHT_CASES.
 *
 * no-unnecessary-assertions: a Testing Library query is a getBy* call too, so the rule reports
 * expect(screen.getByText(...)).toBeTruthy() in Vitest and Jest test files, which hold every hit it made on the corpus
 * (measured, eslint-plugin-playwright 2.12.1).
 *
 * prefer-web-first-assertions: it reports element.getAttribute(...) assertions in Vitest and Jest test files, which hold
 * most of its hits on the corpus, and its fix writes await into a test that is not async there (TS1308); in a
 * Playwright test its fix changes the verdict of several assertions, and rewrites the declaration of a variable it
 * reads, so a value read earlier in the test becomes the live locator (measured, Playwright 1.56.1).
 */
export const ACCEPTED_PW_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = [
  // Only a locator is never undefined: the page's title can be empty.
  {
    heldBy: 'q-lint-rc-unnecessary-assertions-measured',
    ruleCase: {
      rule: 'playwright/no-unnecessary-assertions',
      silentIn: [
        {
          path: 'e2e/visible-dialog.spec.ts',
          source: `${IMPORTS_PLAYWRIGHT}test('opens', async ({ page }) => {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
})
`,
        },
        {
          path: 'e2e/truthy-title.spec.ts',
          source: `${IMPORTS_PLAYWRIGHT}test('has a title', async ({ page }) => {
  expect(await page.title()).toBeTruthy()
})
`,
        },
      ],
      reportedIn: [
        {
          path: 'e2e/defined-locator.spec.ts',
          source: `${IMPORTS_PLAYWRIGHT}test('opens', async ({ page }) => {
  const dialog = page.getByRole('dialog')
  expect(dialog).toBeDefined()
  await expect(dialog).toBeVisible()
})
`,
        },
      ],
    },
  },
  // The page's title is no locator's state, so no web-first assertion reads it.
  {
    heldBy: 'q-lint-rc-web-first-assertions-measured',
    ruleCase: {
      rule: 'playwright/prefer-web-first-assertions',
      silentIn: [
        {
          path: 'e2e/to-be-hidden.spec.ts',
          source: `${IMPORTS_PLAYWRIGHT}test('hides the tooltip', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('tooltip')).toBeHidden()
})
`,
        },
        {
          path: 'e2e/page-title.spec.ts',
          source: `${IMPORTS_PLAYWRIGHT}test('names the page', async ({ page }) => {
  await page.goto('/')
  expect(await page.title()).toBe('Home')
})
`,
        },
      ],
      reportedIn: [
        {
          path: 'e2e/is-visible.spec.ts',
          source: `${IMPORTS_PLAYWRIGHT}test('hides the tooltip', async ({ page }) => {
  await page.goto('/')
  expect(await page.getByRole('tooltip').isVisible()).toBe(false)
})
`,
        },
      ],
    },
  },
]

/**
 * The accepted Playwright rules that report the same line as a shipped vitest rule in Vitest and Jest test files.
 * The owner's answer on card q-lint-playwright-vitest-twins: off by default, recorded as accepted; a team turns them
 * on for its Playwright folder in fileOverrides.
 */
export const PLAYWRIGHT_RULES_OFF_BY_DEFAULT: readonly string[] = [
  'playwright/no-focused-test',
  'playwright/no-identical-title',
  'playwright/prefer-hooks-on-top',
  'playwright/require-to-throw-message',
]

/** The owner's answer on card q-lint-playwright-vitest-twins, as each one's rule-candidates.json entry quotes it. */
export const OWNER_ANSWER_KEEPING_THEM_OFF = `"Don't ship them by default" (q-lint-playwright-vitest-twins)`
