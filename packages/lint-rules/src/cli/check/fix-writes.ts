import { readFileSync, writeFileSync } from 'node:fs'
import { hasErrorCode } from '../caught-errors.ts'

/** A fix run that writes into the files themselves, as `oxlint --fix` does: it stops when the signal aborts. */
export type InPlaceFixer = (paths: readonly string[], signal: AbortSignal) => Promise<void>

/** How a fix run in place ended: where a signal or a failure stopped it, what it threw. */
export type InPlaceFixRun = { readonly outcome: 'completed' } | { readonly outcome: 'stopped'; readonly reason: unknown }

/** Each file's text, by its path. */
export type Snapshots = ReadonlyMap<string, string>

// What reading a path gives where no file is there: another writer deleted it, or put a folder there.
const NO_FILE_THERE = ['ENOENT', 'EISDIR', 'ENOTDIR'] as const

/**
 * Writes ESLint's fixed text only while the file still holds the text ESLint read: a file another
 * writer changed meanwhile keeps that writer's text (F-6). Whether it wrote.
 */
export function writeIfStillUnchanged(path: string, read: string, fixed: string): boolean {
  if (readFileSync(path, 'utf8') !== read) return false
  writeFileSync(path, fixed)
  return true
}

/**
 * Runs the fixer over the files. What it wrote before a signal or a failure stopped it stays, as
 * `eslint --fix` leaves what it wrote (decided 2026-10-15): the caller guards it.
 */
export async function fixInPlace(paths: readonly string[], fixer: InPlaceFixer, signal: AbortSignal): Promise<InPlaceFixRun> {
  try {
    await fixer(paths, signal)
  } catch (error) {
    return { outcome: 'stopped', reason: error }
  }
  return { outcome: 'completed' }
}

export function snapshotsOf(paths: readonly string[]): Snapshots {
  return new Map(paths.map((path) => [path, readFileSync(path, 'utf8')]))
}

/** The file's text: null where no file is at the path any more. */
export function textOfFileAt(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if (NO_FILE_THERE.some((code) => hasErrorCode(error, code))) return null
    throw error
  }
}
