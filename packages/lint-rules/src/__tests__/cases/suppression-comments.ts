// Files that try to silence the suppression ban, or the rule beside it. house/no-classic-loops
// reports the loop on line 4 (line 3 in sameLineDisableOfTheBan), unless a suppression works.

const classicLoop = `export function sumIndexed(items: readonly number[]): number {
  let total = 0
  for (let index = 0; index < items.length; index += 1) {
    total += items[index] ?? 0
  }
  return total
}
`

export const CLASSIC_LOOP_LINE = 4

export const disableOverAClassicLoop = `/* eslint-disable */
${classicLoop}`

export const disableOfTheBanOverAClassicLoop = `/* eslint-disable house/no-suppressions, house/no-classic-loops */
${classicLoop}`

// Names the rule it silences, so unicorn/no-abusive-eslint-disable has nothing to report.
export const namedDisableOverAClassicLoop = `/* eslint-disable house/no-classic-loops */
${classicLoop}`

export const inlineConfigTurningTheBanOff = `/* eslint house/no-suppressions: off, house/no-classic-loops: off */
${classicLoop}`

export const SAME_LINE_DISABLE_LINE = 3

export const sameLineDisableOfTheBan = `export function sumIndexed(items: readonly number[]): number {
  let total = 0
  for (let index = 0; index < items.length; index += 1) { // eslint-disable-line house/no-suppressions, house/no-classic-loops
    total += items[index] ?? 0
  }
  return total
}
`

// ESLint refuses a suppression naming a rule it has no definition of, unless it reads no directive.
export const suppressionOfARuleNobodyDefines = `// eslint-disable-next-line nobody/rule
export const total = 1
`

export const tsIgnore = `// @ts-ignore the total is a string here
export const total: number = '1'
`

export const describedTsExpectError = `// @ts-expect-error the total is a string here
export const total: number = '1'
`

export const bareTsExpectError = `// @ts-expect-error
export const total: number = '1'
`

export const tsNocheck = `// @ts-nocheck
export const total = 1
`

export const disableNextLineOverADebugger = `// eslint-disable-next-line no-debugger
debugger
`

export const DEBUGGER_LINE = 2

/** What disableNextLineOverADebugger suppresses, unsuppressed and on the same line. */
export const unsuppressedDebugger = `export const total = 1
debugger
`
