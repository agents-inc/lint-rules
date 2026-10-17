import type { Linter } from 'eslint'

const SEVERITY_BY_LEVEL = new Map<unknown, Linter.StringSeverity>([
  [0, 'off'],
  [1, 'warn'],
  [2, 'error'],
])

/** Severity only: ESLint fills in default options, and keeps an earlier block's options under a later bare severity. */
export function severityOfCalculatedEntry(entry: unknown): Linter.StringSeverity | undefined {
  if (entry === undefined) return undefined
  const severity = Array.isArray(entry) ? SEVERITY_BY_LEVEL.get(entry[0]) : undefined
  if (severity === undefined) {
    throw new Error(`ESLint calculates a rule entry as [0 | 1 | 2, ...options], not ${JSON.stringify(entry)}`)
  }
  return severity
}
