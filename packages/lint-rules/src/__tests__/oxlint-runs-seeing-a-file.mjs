// Imported into each Node process of a check run ahead of the writer's module, so its exit listener runs first. In
// each oxlint run it writes, to a file named for that run, whether the file named below was there at start and at exit.
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Set by check-fixes.integration.test.ts, under the same name there: JSON, `{ path, folder }`.
const SEEING_VARIABLE = 'AGENTS_INC_TEST_OXLINT_RUNS_SEE_A_FILE'
const OXLINT_BIN = join('oxlint', 'bin', 'oxlint')
const FIX_FLAG = '--fix'

const [, script, ...args] = process.argv

recordInTheOxlintRuns()

function recordInTheOxlintRuns() {
  const seeing = process.env[SEEING_VARIABLE]
  if (seeing === undefined || script === undefined || !script.endsWith(OXLINT_BIN)) return
  const { path, folder } = JSON.parse(seeing)
  const atTheStart = presenceOf(path)
  process.on('exit', () => {
    writeFileSync(join(folder, args.includes(FIX_FLAG) ? 'fix' : 'lint'), `${atTheStart}, then ${presenceOf(path)}`)
  })
}

function presenceOf(path) {
  return existsSync(path) ? 'there' : 'gone'
}
