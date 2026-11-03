import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { CaseFile } from '../rule-case-runs.ts'
import type { RuleCase } from './changed-settings.ts'

// A .js copy of each report case shows the rule reports outside TypeScript too.

const MAP_OF_AN_ARRAY_DISCARDED: CaseFile = {
  path: 'src/save-all.ts',
  source: `type Draft = { save: () => void }

export function saveAll(drafts: Draft[]) {
  drafts.map((draft) => draft.save())
}
`,
}

const SAVED_IN_A_LOOP: CaseFile = {
  path: 'src/save-all-looped.ts',
  source: `type Draft = { save: () => void }

export function saveAll(drafts: Draft[]) {
  for (const draft of drafts) {
    draft.save()
  }
}
`,
}

export const ROUTED_TO_ESLINT_BY_CARD: Readonly<Record<string, string>> = {
  // oxlint's version reports the last item of a NodeList, which has no `.at()`, and its fix there throws.
  'unicorn/prefer-at': 'q-lint-uni-prefer-at-node-lists',
  // oxlint's version merges two calls to a class's own one-value `push`, dropping every value after the first.
  'unicorn/prefer-single-call': 'q-lint-uni-single-call-custom-push',
}

type ProposedEntry = {
  readonly ruleset: string
  readonly engine: 'eslint'
  readonly options: readonly object[]
  readonly typed: boolean
}

export const ACCEPTED_1011_UNI_ENTRIES: Readonly<Record<string, ProposedEntry>> = {
  'unicorn/no-unused-builtin-method-return': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-useless-set-construction': { ruleset: 'redundancy', engine: 'eslint', options: [], typed: false },
  'unicorn/prefer-at': { ruleset: 'modern-js', engine: 'eslint', options: [], typed: false },
  'unicorn/prefer-literal-ascii': { ruleset: 'conventions', engine: 'eslint', options: [], typed: false },
  'unicorn/prefer-single-call': { ruleset: 'redundancy', engine: 'eslint', options: [], typed: false },
  'unicorn/prefer-temporal-conversion': { ruleset: 'modern-js', engine: 'eslint', options: [], typed: false },
}

/** The rule prefer-literal-ascii replaces, which stops shipping, and the decision that drops it. */
export const ACCEPTED_1011_UNI_DROPS: Readonly<Record<string, string>> = {
  'unicorn/no-hex-escape': 'r2-d68',
}

export const ACCEPTED_1011_UNI_CASES: readonly RuleCase[] = [
  {
    rule: 'unicorn/no-unused-builtin-method-return',
    silentIn: [
      SAVED_IN_A_LOOP,
      {
        path: 'src/save-all-voided.ts',
        source: `type Draft = { save: () => void }

export function saveAll(drafts: Draft[]) {
  void drafts.map((draft) => draft.save())
}
`,
      },
    ],
    reportedIn: [
      MAP_OF_AN_ARRAY_DISCARDED,
      {
        path: 'src/save-all.js',
        source: `export function saveAll(drafts) {
  drafts.map((draft) => draft.save())
}
`,
      },
      {
        path: 'src/save-all-readonly.ts',
        source: `type Draft = { save: () => void }

export function saveAll(drafts: readonly Draft[]) {
  drafts.map((draft) => draft.save())
}
`,
      },
      {
        path: 'src/save-until-failed.ts',
        source: `type Draft = { save: () => boolean }

export function saveUntilFailed(drafts: Draft[]) {
  drafts.some((draft) => !draft.save())
}
`,
      },
    ],
  },
  {
    rule: 'unicorn/no-useless-set-construction',
    silentIn: [
      {
        path: 'src/combined-directly.ts',
        source: `const selected = new Set([1, 2])
const extra = new Set([3])

export const combined = selected.union(extra)
`,
      },
      {
        path: 'src/combined-with-counts.ts',
        source: `const selected = new Set([1, 2])
const counts = new Map([['third', 3]])

export const combined = selected.union(new Set(counts.values()))
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/combined.ts',
        source: `const selected = new Set([1, 2])
const extra = new Set([3])

export const combined = selected.union(new Set(extra))
`,
      },
    ],
  },
  {
    rule: 'unicorn/prefer-literal-ascii',
    silentIn: [
      { path: 'src/separator-literal.ts', source: "export const separator = ','\n" },
      { path: 'src/separator-pattern.ts', source: 'export const separatorPattern = /\\x2C/u\n' },
    ],
    reportedIn: [{ path: 'src/separator.ts', source: "export const separator = '\\x2C'\n" }],
  },
  {
    rule: 'unicorn/prefer-temporal-conversion',
    silentIn: [
      {
        path: 'src/starts-at-converted.ts',
        source: `const meeting = Temporal.ZonedDateTime.from('2026-10-11T09:00[Europe/London]')

export const startsAt = meeting.toInstant()
`,
      },
      {
        path: 'src/meeting-copy.ts',
        source: `const meeting = Temporal.ZonedDateTime.from('2026-10-11T09:00[Europe/London]')

export const copy = Temporal.ZonedDateTime.from(meeting)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/starts-at.ts',
        source: `const meeting = Temporal.ZonedDateTime.from('2026-10-11T09:00[Europe/London]')

export const startsAt = Temporal.Instant.from(meeting)
`,
      },
    ],
  },
  {
    rule: 'unicorn/prefer-at',
    silentIn: [
      { path: 'src/last-item-at.ts', source: 'export const lastOf = (items: string[]) => items.at(-1)\n' },
      {
        path: 'src/replace-last.ts',
        source: `export function replaceLast(items: string[], item: string) {
  items[items.length - 1] = item
}
`,
      },
      {
        path: 'src/last-cell.ts',
        source: `export function lastCell() {
  const cells = document.querySelectorAll('td')
  return cells[cells.length - 1]
}
`,
      },
      {
        path: 'src/last-cell.js',
        source: `export function lastCell() {
  const cells = document.querySelectorAll('td')
  return cells[cells.length - 1]
}
`,
      },
      { path: 'src/last-child.ts', source: 'export const lastChild = (element: Element) => element.children[element.children.length - 1]\n' },
    ],
    reportedIn: [
      { path: 'src/last-item.ts', source: 'export const lastOf = (items: string[]) => items[items.length - 1]\n' },
      { path: 'src/last-item.js', source: 'export const lastOf = (items) => items[items.length - 1]\n' },
    ],
  },
  {
    rule: 'unicorn/prefer-single-call',
    silentIn: [
      {
        path: 'src/header-lines-at-once.ts',
        source: `export function headerLines(title: string) {
  const lines: string[] = []
  lines.push(\`# \${title}\`, '')
  return lines
}
`,
      },
      {
        path: 'src/tag-lines.ts',
        source: `export function tagLines(tags: string[]) {
  const lines: string[] = []
  for (const tag of tags) {
    lines.push(\`- \${tag}\`)
  }
  return lines
}
`,
      },
      {
        path: 'src/ring-buffer.ts',
        source: `class RingBuffer {
  readonly #items: number[] = []

  push(value: number) {
    this.#items.push(value)
  }
}

export function filled() {
  const buffer = new RingBuffer()
  buffer.push(1)
  buffer.push(2)
  return buffer
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/header-lines.ts',
        source: `export function headerLines(title: string) {
  const lines: string[] = []
  lines.push(\`# \${title}\`)
  lines.push('')
  return lines
}
`,
      },
      {
        path: 'src/header-lines.js',
        source: `export function headerLines(title) {
  const lines = []
  lines.push(\`# \${title}\`)
  lines.push('')
  return lines
}
`,
      },
      {
        path: 'src/mark.ts',
        source: `export function mark(element: Element) {
  element.classList.add('first')
  element.classList.add('second')
}
`,
      },
    ],
  },
]

export const ACCEPTED_1011_UNI_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = []

export const IGNORED_RETURN_BESIDE_THE_UNUSED_RETURN_RULE: RuleCase = {
  rule: 'sonarjs/no-ignored-return',
  subject: 'a discarded .map() no-unused-builtin-method-return reports',
  silentIn: [SAVED_IN_A_LOOP],
  reportedIn: [MAP_OF_AN_ARRAY_DISCARDED],
}
