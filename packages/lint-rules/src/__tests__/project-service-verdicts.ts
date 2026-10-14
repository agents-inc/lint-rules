import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const VERDICTS_PROCESS = fileURLToPath(new URL('project-service-verdicts-process.ts', import.meta.url))
const TS_FILE = /\.(?:ts|mts|cts|tsx)$/u
// Neither the computation under test nor ESLint walks into these.
const DIRECTORIES_NEVER_WALKED: ReadonlySet<string> = new Set(['node_modules', '.git'])
const GLOB_SEPARATOR = '/'
const VERDICTS_TIMEOUT_MS = 300_000

/**
 * Every TS file under the directory, `.d.ts` included, as a path relative to it with `/` between
 * segments, sorted. node_modules and .git are not walked into.
 */
export function tsFilesUnder(root: string): string[] {
  return filesUnder(root, '').filter((file) => TS_FILE.test(file)).toSorted()
}

/**
 * The TS files under `tsconfigRootDir` that typescript-eslint's project service finds no project for,
 * as ESLint reports them when linting each one with `projectService: true` from that root, sorted.
 * The real service decides, in a process of its own, so this is what a lint run sees.
 */
export function tsFilesTheProjectServiceFindsNoProjectFor(tsconfigRootDir: string): string[] {
  const { status, stdout, stderr } = spawnSync(process.execPath, [VERDICTS_PROCESS, tsconfigRootDir, ...tsFilesUnder(tsconfigRootDir)], {
    cwd: tsconfigRootDir,
    encoding: 'utf8',
    timeout: VERDICTS_TIMEOUT_MS,
  })
  if (status !== 0) throw new Error(`the project service verdicts for ${tsconfigRootDir} failed (exit ${String(status)}): ${stderr}`)
  // Parse boundary: the verdicts process prints a JSON array of paths.
  return (JSON.parse(stdout) as string[]).toSorted()
}

function filesUnder(root: string, fromRoot: string): string[] {
  return readdirSync(join(root, fromRoot), { withFileTypes: true }).flatMap((entry) => {
    const path = fromRoot === '' ? entry.name : `${fromRoot}${GLOB_SEPARATOR}${entry.name}`
    if (entry.isDirectory()) return DIRECTORIES_NEVER_WALKED.has(entry.name) ? [] : filesUnder(root, path)
    return entry.isFile() ? [path] : []
  })
}
