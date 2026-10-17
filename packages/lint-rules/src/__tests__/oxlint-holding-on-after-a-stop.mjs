// Imported into every Node process a check run starts (cli-runs.ts puts it in NODE_OPTIONS), never by a test. In
// oxlint's fix run (`--fix`), it holds the process open once oxlint is done, and has check's SIGTERM mark a file
// instead of ending it: a child that will not stop when asked. It writes its process ID to the other file as it
// starts. Plain JS, as another-writer-as-oxlint-lint-run-ends.mjs is.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Set by cli-runs.ts, under the same name there: JSON, `{ holding, askedToStop }`, two paths.
const MARKERS_VARIABLE = 'AGENTS_INC_TEST_OXLINT_HOLDING_ON'
const OXLINT_BIN = join('oxlint', 'bin', 'oxlint')
const FIX_FLAG = '--fix'
// Far longer than check takes to end once signalled again; the test ends the process once it has its answer.
const HOLD_MS = 30_000

const markers = process.env[MARKERS_VARIABLE]
const [, script, ...args] = process.argv

if (markers !== undefined && script !== undefined && script.endsWith(OXLINT_BIN) && args.includes(FIX_FLAG)) {
  const { holding, askedToStop } = JSON.parse(markers)
  process.on('SIGTERM', () => {
    writeFileSync(askedToStop, '')
  })
  setTimeout(() => undefined, HOLD_MS)
  writeFileSync(holding, String(process.pid))
}
