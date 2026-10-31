// Measured on eslint-plugin-sonarjs 4.2.2: prefer-immediate-return reports each on its line and offers its fix.

/** A source and the line prefer-immediate-return reports in it. */
type ReportedSource = { readonly source: string; readonly line: number }

/** The `using` declaration holds the call of a function whose own const is the one returned. */
export const CONST_RETURNED_INSIDE_A_USING_DECLARATION: ReportedSource = {
  source: `export function openLog(open: () => Disposable) {
  using file = (() => {
    const opened = open()
    return opened
  })()
  return String(file)
}
`,
  line: 3,
}
