import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNodeScript } from './node-process.ts'

const VERDICTS_PROCESS = fileURLToPath(new URL('project-service-verdicts-process.ts', import.meta.url))
const TS_FILE = /\.(?:ts|mts|cts|tsx)$/u
// Neither the computation under test nor ESLint walks into these.
const DIRECTORIES_NEVER_WALKED: ReadonlySet<string> = new Set(['node_modules', '.git'])
const GLOB_SEPARATOR = '/'
const VERDICTS_TIMEOUT_MS = 300_000

/** `.d.ts` included, relative with `/` between segments, sorted. */
export function tsFilesUnder(root: string): string[] {
  return filesUnder(root, '').filter((file) => TS_FILE.test(file)).toSorted()
}

/** Decided by the real service, in a process of its own, linting each file with `projectService: true` from that root. */
export function tsFilesTheProjectServiceFindsNoProjectFor(tsconfigRootDir: string): string[] {
  const stdout = runNodeScript(VERDICTS_PROCESS, [tsconfigRootDir, ...tsFilesUnder(tsconfigRootDir)], {
    cwd: tsconfigRootDir,
    timeoutMs: VERDICTS_TIMEOUT_MS,
    whatFailed: `the project service verdicts for ${tsconfigRootDir} failed`,
  })
  // Parse boundary: the verdicts process prints a JSON array of paths.
  return (JSON.parse(stdout) as string[]).toSorted()
}

function filesUnder(root: string, fromRoot: string): string[] {
  return readdirSync(join(root, fromRoot), { withFileTypes: true }).flatMap((entry) => {
    const path = fromRoot === '' ? entry.name : `${fromRoot}${GLOB_SEPARATOR}${entry.name}`
    if (entry.isDirectory()) return DIRECTORIES_NEVER_WALKED.has(entry.name) ? [] : filesUnder(root, path)
    return entry.isFile() ? path : []
  })
}
