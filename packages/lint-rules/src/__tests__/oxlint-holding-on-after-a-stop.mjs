// Imported into every Node process a check run starts, never by a test: cli-runs.ts's
// oxlintHoldingOnAfterAStop puts it in NODE_OPTIONS, as another-writer-as-oxlint-lint-run-ends.mjs is
// put there. In oxlint's fix run (its arguments hold `--fix`), it holds the process open for a while
// once oxlint is done, and has the SIGTERM check's stop sends mark a file instead of ending the
// process: a child that will not stop when asked. It writes its process ID to the other file as it
// starts. It does nothing in any other process. Plain JS, as the other module is.
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
