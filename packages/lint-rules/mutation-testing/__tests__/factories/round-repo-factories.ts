const FIRST_LINE = 1

/** A module of the lines given, each exporting a constant named for its line. */
export function moduleOfLines(lineCount: number): string {
  return moduleWithLinesRewritten(lineCount, [])
}

/** The same module with the lines given rewritten, so `git diff -U0` gives a hunk for each run of them. */
export function moduleWithLinesRewritten(lineCount: number, rewritten: readonly number[]): string {
  return Array.from({ length: lineCount }, (_, index) => index + FIRST_LINE)
    .map((line) => `export const line${String(line)} = '${rewritten.includes(line) ? 'rewritten' : 'original'}'\n`)
    .join('')
}

/** A JSON Stryker config. The round script reads its `mutate` patterns alone. */
export function strykerJsonConfig(mutate: readonly string[]): string {
  return JSON.stringify({ mutate })
}

/** A `.gitignore` of the patterns given, one a line. */
export function gitIgnoreOf(patterns: readonly string[]): string {
  return patterns.map((pattern) => `${pattern}\n`).join('')
}

/** A JavaScript Stryker config, its options as the default export. */
export function strykerModuleConfig(mutate: readonly string[]): string {
  return `export default ${JSON.stringify({ mutate })}\n`
}
