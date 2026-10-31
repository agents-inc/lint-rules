// The oxlint plugin another-writer-deleting-while-oxlint-runs.mjs loads into one of check's oxlint runs, never a test.
// Its one rule reports nothing. On the first file oxlint lints, it leaves the marker: where that is another file, it
// deletes the file first, which oxlint, on one thread there, has not opened yet. Plain JS, as that is.
import { existsSync, rmSync, writeFileSync } from 'node:fs'

// Set by cli-runs.ts, under the same name there: JSON, `{ path, run, when, marker }`.
const DELETION_VARIABLE = 'AGENTS_INC_TEST_DELETES_WHILE_OXLINT_RUNS'
// What the marker holds where oxlint lints the file before any other, so it is never deleted before oxlint opens it.
const OPENED_FIRST = 'oxlint opened it first'

const { path, when, marker } = JSON.parse(process.env[DELETION_VARIABLE])

export default {
  meta: { name: 'another-writer' },
  rules: {
    'deletes-a-file': {
      create(context) {
        if (!existsSync(marker)) {
          const isAnotherFile = context.filename !== path
          if (isAnotherFile) rmSync(path)
          writeFileSync(marker, isAnotherFile ? when : OPENED_FIRST)
        }
        return {}
      },
    },
  },
}
