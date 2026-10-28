import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// run-generate.ts writes the generated files only when Node runs it as the script, as `bun run generate` does; the
// staleness test imports it for generateFiles. Imported by a Node process of its own, it must write nothing.

type NodeRun = { readonly exitCode: number | null; readonly stderr: string }

const RUN_GENERATE_MODULE = new URL('run-generate.ts', import.meta.url).href
const GENERATED_DIR = fileURLToPath(new URL('../generated/', import.meta.url))
const ANOTHER_SCRIPT = fileURLToPath(new URL('build-routing.ts', import.meta.url))
const IMPORT_THE_MODULE = 'await import(process.env.MODULE_TO_IMPORT)'
// Node 23 warns on stderr that type stripping is experimental; the import is under test, not that notice.
const NO_EXPERIMENTAL_WARNING = '--disable-warning=ExperimentalWarning'
const IMPORT_TIMEOUT_MS = 120_000

/** When each generated file was last written, by its name. */
function lastWrittenByFile(): ReadonlyMap<string, number> {
  return new Map(readdirSync(GENERATED_DIR).map((file) => [file, statSync(join(GENERATED_DIR, file)).mtimeMs]))
}

/** The generated files written since the times given. */
function writtenSince(lastWritten: ReadonlyMap<string, number>): string[] {
  return [...lastWrittenByFile()].filter(([file, time]) => lastWritten.get(file) !== time).map(([file]) => file)
}

/** run-generate.ts imported by a Node process running `--eval`, given the script arguments named. */
function importedByANodeProcess(scriptArguments: readonly string[]): NodeRun {
  const { status, stderr } = spawnSync(process.execPath, [NO_EXPERIMENTAL_WARNING, '--input-type=module', '--eval', IMPORT_THE_MODULE, ...scriptArguments], {
    encoding: 'utf8',
    env: { ...process.env, MODULE_TO_IMPORT: RUN_GENERATE_MODULE },
  })
  return { exitCode: status, stderr }
}

describe('run-generate.ts, imported rather than run as the script', () => {
  it(
    'writes no generated file in a process given no script',
    () => {
      const lastWritten = lastWrittenByFile()

      const run = importedByANodeProcess([])

      expect({ ...run, written: writtenSince(lastWritten) }).toStrictEqual({ exitCode: 0, stderr: '', written: [] })
    },
    IMPORT_TIMEOUT_MS,
  )

  it(
    'writes no generated file in a process running another script',
    () => {
      const lastWritten = lastWrittenByFile()

      const run = importedByANodeProcess([ANOTHER_SCRIPT])

      expect({ ...run, written: writtenSince(lastWritten) }).toStrictEqual({ exitCode: 0, stderr: '', written: [] })
    },
    IMPORT_TIMEOUT_MS,
  )
})
