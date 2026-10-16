import { rmSync, watch, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Watches one folder for names that appear in it, as a file created there makes one appear. */
export type FolderWatch = {
  /** Resolves with the first name matching the pattern to appear, one seen already included. */
  readonly appeared: (pattern: RegExp) => Promise<string>
  /** Every name that appeared since the watch began, once each, in order, after every change made before the call has been seen. */
  readonly namesSeen: () => Promise<string[]>
  readonly close: () => void
}

const FLUSH_FILE_PREFIX = '.folder-watch-flush-'

/** Watches the folder's own entries, not its subfolders'. Close it when done. */
export function watchFolder(dir: string): FolderWatch {
  const seen: string[] = []
  const waiting: { readonly pattern: RegExp; readonly resolve: (name: string) => void }[] = []
  const watcher = watch(dir, (_event, name) => {
    if (name === null) return
    if (!seen.includes(name)) seen.push(name)
    waiting.filter(({ pattern }) => pattern.test(name)).forEach(({ resolve }) => resolve(name))
  })

  const appeared = (pattern: RegExp): Promise<string> =>
    new Promise((resolve) => {
      const already = seen.find((name) => pattern.test(name))
      if (already === undefined) waiting.push({ pattern, resolve })
      else resolve(already)
    })

  return {
    appeared,
    // The folder's changes are reported in the order they were made, so once a file written now has
    // been seen, so has every change before it.
    namesSeen: async () => {
      const flushFile = `${FLUSH_FILE_PREFIX}${String(process.pid)}-${String(seen.length)}`
      const flushed = appeared(new RegExp(`^${escapeForPattern(flushFile)}$`, 'u'))
      writeFileSync(join(dir, flushFile), '')
      await flushed
      rmSync(join(dir, flushFile))
      return seen.filter((name) => !name.startsWith(FLUSH_FILE_PREFIX))
    },
    close: () => watcher.close(),
  }
}

/** The literal as a regular expression's source, its special characters escaped. */
export function escapeForPattern(literal: string): string {
  return literal.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)
}
