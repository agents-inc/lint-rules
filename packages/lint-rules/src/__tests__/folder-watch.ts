import { randomUUID } from 'node:crypto'
import { rmSync, writeFileSync } from 'node:fs'
import { type FileChangeInfo, watch } from 'node:fs/promises'
import { join } from 'node:path'
import { hasErrorCode } from '../core/caught-errors.ts'

/** Watches one folder for names that appear in it, as a file created there makes one appear. */
export type FolderWatch = {
  /** Resolves with the first name matching the pattern to appear, one seen already included. */
  readonly appeared: (pattern: Readonly<RegExp>) => Promise<string>
  /** Every name that appeared since the watch began, once each, in order, after every change made before the call has been seen. */
  readonly namesSeen: () => Promise<string[]>
  readonly close: () => void
}

/** A change the folder reported, and the next one: null once the watch is closed. */
type ChangeSeen = { readonly name: string | null; readonly next: Promise<ChangeSeen | null> }

const FLUSH_FILE_PREFIX = '.folder-watch-flush-'
// What reading the next change of a closed watch rejects with.
const ABORTED = 'ABORT_ERR'

/** Watches the folder's own entries, not its subfolders'. Close it when done. */
export function watchFolder(dir: string): FolderWatch {
  const closing = new AbortController()
  // Read from now on, so every change made after this call is in the chain.
  const firstChange = changeSeenNext(watch(dir, { signal: closing.signal }))

  return {
    appeared(pattern) {
      return firstNameMatching(firstChange, (name) => pattern.test(name))
    },
    // The folder's changes are reported in the order they were made, so once a file written now has
    // been seen, so has every change before it.
    async namesSeen() {
      const flushFile = `${FLUSH_FILE_PREFIX}${String(process.pid)}-${randomUUID()}`
      writeFileSync(join(dir, flushFile), '')
      const names = await namesBefore(firstChange, flushFile)
      rmSync(join(dir, flushFile))
      return [...new Set(names)].filter((name) => !name.startsWith(FLUSH_FILE_PREFIX))
    },
    close() {
      closing.abort()
    },
  }
}

export function escapeForPattern(literal: string): string {
  return literal.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)
}

async function changeSeenNext(changes: AsyncIterator<FileChangeInfo<string>>): Promise<ChangeSeen | null> {
  try {
    const change = await changes.next()
    return change.done === true ? null : { name: change.value.filename, next: changeSeenNext(changes) }
  } catch (error) {
    if (hasErrorCode(error, ABORTED)) return null
    throw error
  }
}

/** Never settles where the watch closes first, as nothing more can appear. */
async function firstNameMatching(seen: Promise<ChangeSeen | null>, isAwaited: (name: string) => boolean): Promise<string> {
  const change = await seen
  if (change === null) return neverSettling()
  return change.name !== null && isAwaited(change.name) ? change.name : firstNameMatching(change.next, isAwaited)
}

/** The names that appeared before `last` did, in order. Never settles where the watch closes first. */
async function namesBefore(seen: Promise<ChangeSeen | null>, last: string, before: readonly string[] = []): Promise<readonly string[]> {
  const change = await seen
  if (change === null) return neverSettling()
  if (change.name === last) return before
  return namesBefore(change.next, last, change.name === null ? before : [...before, change.name])
}

function neverSettling(): Promise<never> {
  return new Promise(() => {
    // Nothing settles it: no name appears in a closed watch.
  })
}
