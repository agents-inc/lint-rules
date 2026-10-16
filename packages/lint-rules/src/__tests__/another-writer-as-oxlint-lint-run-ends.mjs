// Imported into every Node process a check run starts, never by a test: cli-runs.ts's
// anotherWriterAsOxlintsLintRunEnds puts it in NODE_OPTIONS, as the mutation run puts its
// child-coverage-hook.mjs there. In oxlint's lint run, the last of check's two oxlint runs (its
// arguments hold no `--fix`), it writes each file the variable below names, with the text it gives,
// as that process exits: after oxlint read every file and reported, and before check, which waits for
// oxlint to end, reads them again. In a real run another writer lands there by chance; here it lands
// there every time. It does nothing in any other process. Plain JS: a TypeScript module imported this
// way prints a warning about type stripping to stderr on Node 23.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Set by cli-runs.ts, under the same name there: JSON, an array of `{ path, text }`.
const WRITES_VARIABLE = 'AGENTS_INC_TEST_WRITES_AS_OXLINT_LINT_RUN_ENDS'
const OXLINT_BIN = join('oxlint', 'bin', 'oxlint')
const FIX_FLAG = '--fix'

const writes = process.env[WRITES_VARIABLE]
const [, script, ...args] = process.argv

if (writes !== undefined && script !== undefined && script.endsWith(OXLINT_BIN) && !args.includes(FIX_FLAG)) {
  process.on('exit', () => {
    JSON.parse(writes).forEach(({ path, text }) => writeFileSync(path, text))
  })
}
