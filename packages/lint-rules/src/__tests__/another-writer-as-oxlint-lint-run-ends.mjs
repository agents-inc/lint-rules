// Imported into every Node process a check run starts (cli-runs.ts puts it in NODE_OPTIONS), never by a test. In
// oxlint's lint run, the last of check's two (no `--fix`), it writes each file the variable below names as the
// process exits: after oxlint read them and before check reads them again, where a real writer lands by chance.
// Plain JS: a TypeScript module imported this way warns about type stripping on Node 23.
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
