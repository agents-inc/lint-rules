import { readFileSync, writeFileSync } from 'node:fs'
import { hasErrorCode } from '../caught-errors.ts'

export type InPlaceFixer = (paths: readonly string[], signal: AbortSignal) => Promise<void>

export type InPlaceFixRun = { readonly outcome: 'completed' } | { readonly outcome: 'stopped'; readonly reason: unknown }

export type Snapshots = ReadonlyMap<string, string>

// Another writer deleted the file, or put a folder there.
const NO_FILE_THERE = ['ENOENT', 'EISDIR', 'ENOTDIR'] as const

/** A file another writer changed meanwhile keeps that writer's text. Returns whether it wrote. */
export function writeIfStillUnchanged(path: string, read: string, fixed: string): boolean {
  if (readFileSync(path, 'utf8') !== read) return false
  writeFileSync(path, fixed)
  return true
}

/** What the fixer wrote before a stop stays, as `eslint --fix` leaves it: the caller guards it. */
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

export function textOfFileAt(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if (NO_FILE_THERE.some((code) => hasErrorCode(error, code))) return null
    throw error
  }
}
