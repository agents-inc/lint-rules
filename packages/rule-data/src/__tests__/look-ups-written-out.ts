import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TYPESCRIPT_SOURCE = /\.ts$/u
const TEST_SOURCE = /(?:\.test\.ts|\.test-d\.ts)$|(?:^|\/)__tests__\//u
// A check for undefined that throws, on its own line or in its block: what foundOr says in one call. Before the
// throw the block may hold template placeholders but no other brace, so a throw after a nested block is missed.
const A_MISS_THAT_THROWS = /=== undefined\)\s*(?:\{(?:[^{}]|\$\{[^{}]*\})*?)?\bthrow\b/gu
const LINE_BREAK = '\n'

/** The line of each look-up written out by hand in the source text, from 1. */
export function linesWritingOutALookUp(source: string): number[] {
  return source
    .matchAll(A_MISS_THAT_THROWS)
    .map(({ index }) => lineAt(source, index))
    .toArray()
}

/** `file:line` for each look-up written out by hand in the folder's TypeScript, tests aside, sorted by file. */
export function lookUpsWrittenOutIn(sourceDir: string): string[] {
  return nonTestSourceFilesIn(sourceDir).flatMap((file) => lookUpsWrittenOutInFile(sourceDir, file))
}

function lookUpsWrittenOutInFile(sourceDir: string, file: string): string[] {
  const source = readFileSync(join(sourceDir, file), 'utf8')
  return linesWritingOutALookUp(source).map((line) => `${file}:${String(line)}`)
}

function nonTestSourceFilesIn(sourceDir: string): string[] {
  return readdirSync(sourceDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => TYPESCRIPT_SOURCE.test(file) && !TEST_SOURCE.test(file))
    .toSorted()
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split(LINE_BREAK).length
}
