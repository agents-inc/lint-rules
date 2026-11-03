import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// no-duplicate-parameterized-test-case's fix is withheld: it deletes a row that repeats another row's text, so
// `it.each([[nextId()], [nextId()]])` runs once.

type ProposedEntry = {
  readonly ruleset: string
  readonly engine: 'eslint'
  readonly options: readonly object[]
  readonly typed: boolean
}

export const ACCEPTED_1011_SNR_ENTRIES: Readonly<Record<string, ProposedEntry>> = {
  'sonarjs/composite-assertions': { ruleset: 'tests', engine: 'eslint', options: [], typed: false },
  'sonarjs/no-debounce-throttle-in-render': { ruleset: 'react', engine: 'eslint', options: [], typed: false },
  'sonarjs/no-duplicate-parameterized-test-case': { ruleset: 'tests', engine: 'eslint', options: [], typed: false },
  'sonarjs/no-empty-parameterized-test-dataset': { ruleset: 'tests', engine: 'eslint', options: [], typed: false },
  'sonarjs/synchronous-exception-assertions': { ruleset: 'tests', engine: 'eslint', options: [], typed: true },
}

export const ACCEPTED_1011_SNR_CASES: readonly RuleCase[] = [
  {
    rule: 'sonarjs/composite-assertions',
    silentIn: [
      {
        path: 'src/active-admin-whole.test.ts',
        source: `import { expect, it } from 'vitest'

it('creates an active admin', () => {
  const user = { role: 'admin', active: true }
  expect(user).toStrictEqual({ role: 'admin', active: true })
})
`,
      },
      {
        path: 'src/guarded-user.test.ts',
        source: `import { expect, it } from 'vitest'

declare function findUser(id: string): { readonly active: boolean } | undefined

it('finds an active user', () => {
  const user = findUser('ada')
  expect(user !== undefined && user.active).toBeTruthy()
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/active-admin.test.ts',
        source: `import { expect, it } from 'vitest'

it('creates an active admin', () => {
  const user = { role: 'admin', active: true }
  expect(user.role === 'admin' && user.active).toBeTruthy()
})
`,
      },
      {
        path: 'src/not-banned-or-deleted.test.ts',
        source: `import { expect, it } from 'vitest'

it('keeps a new user in good standing', () => {
  const user = { banned: false, deleted: false }
  expect(user.banned || user.deleted).toBeFalsy()
})
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-debounce-throttle-in-render',
    silentIn: [
      {
        path: 'src/memoized-search.tsx',
        source: `import { debounce } from 'lodash'
import { useMemo } from 'react'

export function Search({ onSearch }: { onSearch: (query: string) => void }) {
  const search = useMemo(() => debounce(onSearch, 300), [onSearch])
  return <input onChange={(event) => search(event.target.value)} />
}
`,
      },
      {
        path: 'src/module-level-search.tsx',
        source: `import { debounce } from 'lodash'

const logSearch = debounce((query: string) => console.log(query), 300)

export function Search() {
  return <input onChange={(event) => logSearch(event.target.value)} />
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/search.tsx',
        source: `import { debounce } from 'lodash'

export function Search({ onSearch }: { onSearch: (query: string) => void }) {
  const search = debounce(onSearch, 300)
  return <input onChange={(event) => search(event.target.value)} />
}
`,
      },
      {
        path: 'src/use-throttled-report.ts',
        source: `import throttle from 'lodash/throttle'

export function useThrottledReport(report: (value: number) => void) {
  return throttle(report, 100)
}
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-empty-parameterized-test-dataset',
    silentIn: [
      {
        path: 'src/unchanged-values.test.ts',
        source: `import { expect, it } from 'vitest'

it.each(['a', 'b'])('keeps %s unchanged', (value) => {
  expect(String(value)).toBe(value)
})
`,
      },
      {
        path: 'src/filled-dataset.test.ts',
        source: `import { expect, it } from 'vitest'

const values: string[] = []
values.push('a')

it.each(values)('keeps %s unchanged', (value) => {
  expect(String(value)).toBe(value)
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/empty-dataset.test.ts',
        source: `import { expect, it } from 'vitest'

it.each([])('keeps %s unchanged', (value) => {
  expect(String(value)).toBe(value)
})
`,
      },
      {
        path: 'src/empty-variable-dataset.test.ts',
        source: `import { expect, it } from 'vitest'

const values: string[] = []

it.each(values)('keeps %s unchanged', (value) => {
  expect(String(value)).toBe(value)
})
`,
      },
    ],
  },
  {
    rule: 'sonarjs/synchronous-exception-assertions',
    silentIn: [
      {
        path: 'src/rejects-empty-id.test.ts',
        source: `import { expect, it } from 'vitest'

declare function loadUser(id: string): Promise<{ id: string }>

it('rejects an empty id', async () => {
  await expect(loadUser('')).rejects.toThrow()
})
`,
      },
      {
        path: 'src/sync-throw.test.ts',
        source: `import { expect, it } from 'vitest'

declare function parseAmount(text: string): number

it('rejects a negative amount', () => {
  expect(() => parseAmount('-1')).toThrow()
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/async-callback-throw.test.ts',
        source: `import { expect, it } from 'vitest'

declare function loadUser(id: string): Promise<{ id: string }>

it('rejects an empty id', () => {
  expect(async () => loadUser('')).toThrow()
})
`,
      },
      {
        path: 'src/non-callable-throw.test.ts',
        source: `import { expect, it } from 'vitest'

declare function parseAmount(text: string): number

it('rejects a negative amount', () => {
  expect(parseAmount('-1')).toThrow()
})
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-duplicate-parameterized-test-case',
    silentIn: [
      {
        path: 'src/doubles-distinct.test.ts',
        source: `import { expect, it } from 'vitest'

it.each([
  [1, 2],
  [2, 4],
])('doubles %i', (input, expected) => {
  expect(input * 2).toBe(expected)
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/doubles.test.ts',
        source: `import { expect, it } from 'vitest'

it.each([
  [1, 2],
  [1, 2],
])('doubles %i', (input, expected) => {
  expect(input * 2).toBe(expected)
})
`,
      },
    ],
  },
]

export const ACCEPTED_1011_SNR_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = []
