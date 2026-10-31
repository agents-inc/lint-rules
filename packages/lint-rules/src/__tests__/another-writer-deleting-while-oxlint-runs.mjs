// Imported into every Node process a check run starts (cli-runs.ts puts it in NODE_OPTIONS), never by a test. In the
// oxlint run the variable below names (`fix`, with `--fix`, or `lint`), it deletes a file at a point oxlint's own
// progress sets, where a real writer lands by chance:
// - `as the run ends`: as the process exits, after oxlint read every file and wrote its fixes;
// - `before oxlint opens it`: oxlint runs on one thread, so it opens the files one at a time, in the order check names
//   them, and loads oxlint-plugin-deleting-a-file.mjs, whose rule deletes it while oxlint lints the first.
// Plain JS, as another-writer-as-oxlint-lint-run-ends.mjs is.
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Set by cli-runs.ts, under the same name there: JSON, `{ path, run, when, marker }`.
const DELETION_VARIABLE = 'AGENTS_INC_TEST_DELETES_WHILE_OXLINT_RUNS'
const OXLINT_BIN = join('oxlint', 'bin', 'oxlint')
const FIX_FLAG = '--fix'
const CONFIG_FLAG = '-c'
const ONE_THREAD = '--threads=1'
const AS_THE_RUN_ENDS = 'as the run ends'
const PLUGIN = fileURLToPath(new URL('./oxlint-plugin-deleting-a-file.mjs', import.meta.url))
// The plugin's name, then its rule's, as oxlint-plugin-deleting-a-file.mjs gives them.
const PLUGIN_RULE = 'another-writer/deletes-a-file'
const FIRST_ARGUMENT = 2

const deletion = process.env[DELETION_VARIABLE]
const [, script, ...args] = process.argv

if (deletion !== undefined && script !== undefined && script.endsWith(OXLINT_BIN)) {
  const { path, run, when, marker } = JSON.parse(deletion)
  if ((run === 'fix') === args.includes(FIX_FLAG)) {
    if (when === AS_THE_RUN_ENDS) {
      process.on('exit', () => {
        rmSync(path)
        writeFileSync(marker, when)
      })
    } else {
      // oxlint reads its arguments once this module has run.
      process.argv.splice(FIRST_ARGUMENT, 0, ONE_THREAD)
      const configPath = args[args.indexOf(CONFIG_FLAG) + 1]
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      writeFileSync(configPath, JSON.stringify({ ...config, jsPlugins: [...(config.jsPlugins ?? []), PLUGIN], rules: { ...config.rules, [PLUGIN_RULE]: 'error' } }))
    }
  }
}
