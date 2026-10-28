import { readFileSync, writeFileSync } from 'node:fs'
import { hasErrorCode } from '../../core/caught-errors.ts'

export type InPlaceFixer = (paths: readonly string[], signal: Readonly<AbortSignal>) => Promise<void>

type InPlaceFixRun = { readonly outcome: 'completed' } | { readonly outcome: 'stopped'; readonly reason: unknown }

export type Snapshots = ReadonlyMap<string, string>

// Another writer deleted the file, or put a folder there.
const NO_FILE_THERE = ['ENOENT', 'EISDIR', 'ENOTDIR'] as const

/** A file another writer changed, or left no file at, meanwhile keeps what that writer left. Returns whether it wrote. */
export function writesIfStillUnchanged(path: string, read: string, fixed: string): boolean {
  if (textOfFileAt(path) !== read) return false
  writeFileSync(path, fixed)
  return true
}

/** What the fixer wrote before a stop stays, as `eslint --fix` leaves it: the caller guards it. */
export async function fixInPlace(paths: readonly string[], fixer: InPlaceFixer, signal: Readonly<AbortSignal>): Promise<InPlaceFixRun> {
  try {
    await fixer(paths, signal)
  } catch (error) {
    return { outcome: 'stopped', reason: error }
  }
  return { outcome: 'completed' }
}

/** A path with no file now is left out. */
export function snapshotsOf(paths: readonly string[]): Snapshots {
  return new Map(paths.flatMap(snapshotOf))
}

function snapshotOf(path: string): Array<[string, string]> {
  const text = textOfFileAt(path)
  return text === null ? [] : [[path, text]]
}

/** Null where another writer deleted the file or put a folder there. */
export function textOfFileAt(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if (NO_FILE_THERE.some((code) => hasErrorCode(error, code))) return null
    throw error
  }
}
