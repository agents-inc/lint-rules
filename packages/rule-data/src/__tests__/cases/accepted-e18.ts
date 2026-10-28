import type { RuleCase } from './changed-settings.ts'

// The e18e rule the owner accepted on 2026-10-24: it reports a sync stat call whose missing-entry error a catch turns
// into an answer, and stays silent on the call told not to throw, on the rule's own advice of the option with the
// catch kept for the errors that are real, and on the promise API's stat, which takes no such option (measured,
// Node 22.23: passed { throwIfNoEntry: false }, it still rejects with ENOENT).

const IMPORTS_STAT_SYNC = "import { statSync } from 'node:fs'\n\n"

/** The shipped accepted e18e rule's report case beside its silent twin. */
export const ACCEPTED_E18E_CASES: readonly RuleCase[] = [
  {
    rule: 'e18e/prefer-throw-if-no-entry',
    silentIn: [
      {
        path: 'src/size-without-throwing.ts',
        source: `${IMPORTS_STAT_SYNC}export function sizeOf(path: string) {
  const stats = statSync(path, { throwIfNoEntry: false })
  return stats === undefined ? 0 : stats.size
}
`,
      },
      {
        path: 'src/catch-kept-for-real-errors.ts',
        source: `${IMPORTS_STAT_SYNC}export function sizeOf(path: string) {
  try {
    const stats = statSync(path, { throwIfNoEntry: false })
    return stats === undefined ? 0 : stats.size
  } catch (error) {
    throw new Error(\`could not read \${path}\`, { cause: error })
  }
}
`,
      },
      {
        path: 'src/promised-stat.ts',
        source: `import { stat } from 'node:fs/promises'

export async function sizeOf(path: string) {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/size-from-a-catch.ts',
        source: `${IMPORTS_STAT_SYNC}export function sizeOf(path: string) {
  try {
    return statSync(path).size
  } catch {
    return 0
  }
}
`,
      },
      {
        path: 'src/presence-from-a-catch.ts',
        source: `${IMPORTS_STAT_SYNC}export function isPresent(path: string) {
  try {
    statSync(path)
    return true
  } catch {
    return false
  }
}
`,
      },
      {
        path: 'src/link-from-a-catch.js',
        source: `import fs from 'node:fs'

export function isLink(path) {
  try {
    return fs.lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}
`,
      },
    ],
  },
]
