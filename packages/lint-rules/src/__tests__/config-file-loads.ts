import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { installedPackage } from './temp-projects.ts'

/** What a Node process or the TypeScript compiler printed, and how it exited. */
export type ProcessResult = { readonly exitCode: number | null; readonly stdout: string; readonly stderr: string }

export const INSTALLED_TYPESCRIPT = installedPackage('typescript')
export const INSTALLED_TYPES_NODE = installedPackage('@types/node')

const TSC = join(INSTALLED_TYPESCRIPT.dir, 'bin', 'tsc')
// Prints the names the module exports, sorted, space-separated: a module that throws on import exits 1.
const PRINT_EXPORTED_NAMES = 'const loaded = await import(process.argv[1]); console.log(Object.keys(loaded).toSorted().join(" "))'
// Node 23 warns on stderr that type stripping is experimental when it imports a `.mts` file (measured,
// 23.10; 22.23 does not). The machine's Node may be outside the package's `engines`; the import is
// what is under test, not Node's notice of how it loads TypeScript.
const NO_EXPERIMENTAL_WARNING = '--disable-warning=ExperimentalWarning'

/** Imports the module in a Node process of its own, as an engine loads a config: the names it exports, or why it could not. */
export function importInNode(file: string): ProcessResult {
  const { status, stdout, stderr } = spawnSync(process.execPath, [NO_EXPERIMENTAL_WARNING, '--input-type=module', '--eval', PRINT_EXPORTED_NAMES, pathToFileURL(file).href], {
    encoding: 'utf8',
  })
  return { exitCode: status, stdout, stderr }
}

/** `tsc --noEmit` over the project's tsconfig.json, with the TypeScript this repo installs. */
export function typeCheck(projectDir: string): ProcessResult {
  const { status, stdout, stderr } = spawnSync(process.execPath, [TSC, '--noEmit', '-p', projectDir], { encoding: 'utf8' })
  return { exitCode: status, stdout, stderr }
}
