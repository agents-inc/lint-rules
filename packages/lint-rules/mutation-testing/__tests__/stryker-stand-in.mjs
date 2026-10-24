// Run in Stryker's place where a test runs the round script (round-script-runs.ts puts a `bun` on PATH that runs
// it), never by a test: it records the arguments `bun run mutation` was given and writes the report Stryker's json
// reporter would, so no mutant is ever run. Plain JS: a TypeScript module run this way warns about type stripping on Node 23.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Set by round-script-runs.ts, under the same names there: a JSON file of every run's arguments, and the report's text.
const RUNS_VARIABLE = 'STRYKER_STAND_IN_RUNS'
const REPORT_VARIABLE = 'STRYKER_STAND_IN_REPORT'
// Where Stryker's json reporter writes, from the folder it runs in.
const REPORT_DIR = join('reports', 'mutation')
const REPORT_FILE = join(REPORT_DIR, 'mutation.json')

function variable(name) {
  const value = process.env[name]
  if (value === undefined) throw new Error(`the Stryker stand-in was run without ${name}`)
  return value
}

const runsFile = variable(RUNS_VARIABLE)
const runsBefore = existsSync(runsFile) ? JSON.parse(readFileSync(runsFile, 'utf8')) : []
writeFileSync(runsFile, JSON.stringify([...runsBefore, process.argv.slice(2)]))
mkdirSync(REPORT_DIR, { recursive: true })
writeFileSync(REPORT_FILE, variable(REPORT_VARIABLE))
