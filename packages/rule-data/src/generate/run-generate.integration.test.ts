import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { cp, readFile, readdir, realpath, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { setUpTempDir } from '../__tests__/temp-dirs.ts'
import { compareCodeUnits } from '../collections.ts'
import { type GeneratedFile, generateFiles } from './run-generate.ts'

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

const PACKAGE_DIR = fileURLToPath(new URL('../../', import.meta.url))
const WORKSPACE_NODE_MODULES = fileURLToPath(new URL('../../../../node_modules', import.meta.url))
const NODE_MODULES = 'node_modules'
const PARTS_THE_GENERATOR_READS = ['package.json', 'data', 'src']
const GENERATED_FOLDER = 'src/generated'
const SCRIPT_IN_THE_PACKAGE = 'src/generate/run-generate.ts'
const PACKAGE_COPY = 'rule-data'

function lastWrittenByFile(): ReadonlyMap<string, number> {
  return new Map(readdirSync(GENERATED_DIR).map((file) => [file, statSync(join(GENERATED_DIR, file)).mtimeMs]))
}

function writtenSince(lastWritten: ReadonlyMap<string, number>): string[] {
  return [...lastWrittenByFile()].filter(([file, time]) => lastWritten.get(file) !== time).map(([file]) => file)
}

function importedByANodeProcess(scriptArguments: readonly string[]): NodeRun {
  const { status, stderr } = spawnSync(process.execPath, [NO_EXPERIMENTAL_WARNING, '--input-type=module', '--eval', IMPORT_THE_MODULE, ...scriptArguments], {
    encoding: 'utf8',
    env: { ...process.env, MODULE_TO_IMPORT: RUN_GENERATE_MODULE },
  })
  return { exitCode: status, stderr }
}

// Copied without its generated folder, so what the script writes there is what this run wrote.
async function copyThePackageInto(dir: string): Promise<string> {
  const copyDir = join(dir, PACKAGE_COPY)
  await Promise.all(PARTS_THE_GENERATOR_READS.map(async (part) => cp(join(PACKAGE_DIR, part), join(copyDir, part), { recursive: true, filter: isOutsideTheGeneratedFolder })))
  await Promise.all([symlink(WORKSPACE_NODE_MODULES, join(dir, NODE_MODULES)), symlink(join(PACKAGE_DIR, NODE_MODULES), join(copyDir, NODE_MODULES))])
  return copyDir
}

function isOutsideTheGeneratedFolder(source: string): boolean {
  return source !== join(PACKAGE_DIR, GENERATED_FOLDER)
}

async function runAsTheScriptIn(packageDir: string): Promise<NodeRun> {
  // The script writes only where its path, as given, is its import.meta.url, which Node resolves to the real path.
  const script = await realpath(join(packageDir, SCRIPT_IN_THE_PACKAGE))
  const { status, stderr } = spawnSync(process.execPath, [NO_EXPERIMENTAL_WARNING, script], { encoding: 'utf8' })
  return { exitCode: status, stderr }
}

async function generatedFilesIn(packageDir: string): Promise<GeneratedFile[]> {
  const generatedDir = join(packageDir, GENERATED_FOLDER)
  if (!existsSync(generatedDir)) return []
  const files = await readdir(generatedDir)
  const generated = await Promise.all(files.map(async (file) => ({ path: `${GENERATED_FOLDER}/${file}`, contents: await readFile(join(generatedDir, file), 'utf8') })))
  return generated.toSorted((first, second) => compareCodeUnits(first.path, second.path))
}

describe('run-generate.ts, run as the script', () => {
  const tempDir = setUpTempDir('rule-data-run-generate-')

  it(
    'writes each file generateFiles builds under the package root, making the folder they go in',
    async () => {
      const packageDir = await copyThePackageInto(tempDir())

      const run = await runAsTheScriptIn(packageDir)

      const built = (await generateFiles()).toSorted((first, second) => compareCodeUnits(first.path, second.path))
      expect({ ...run, written: await generatedFilesIn(packageDir) }).toStrictEqual({ exitCode: 0, stderr: '', written: built })
    },
    IMPORT_TIMEOUT_MS,
  )
})

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
