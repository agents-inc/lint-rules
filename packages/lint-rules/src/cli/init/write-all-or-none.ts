import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { messageOf } from '../caught-errors.ts'

/** A file's whole new text, by its path. */
export type FileWrite = { readonly path: string; readonly text: string }

/** A file as it was before the writes: its text, or null where there was none. */
type Original = { readonly path: string; readonly text: string | null }

const TEMP_SUFFIX = `.agents-inc-init-${String(process.pid)}.tmp`

/**
 * Writes every file or none (spec-cli.md "I: init", step 5). Each text goes to a temporary file in
 * its own folder first, and only once all are written does each replace its file by a rename. A
 * failure puts back each file replaced before it and leaves no temporary file, then throws, naming
 * the path it failed on as given.
 */
export function writeAllOrNone(writes: readonly FileWrite[]): void {
  writeEachToItsTempFile(writes)
  replaceEachFileByItsTempFile(writes)
}

/** A failure removes the temporary files written before it, and its own: a write that fails part way, as on a full disk, leaves one. */
function writeEachToItsTempFile(writes: readonly FileWrite[]): void {
  writes.forEach((write, index) => {
    try {
      writeFileSync(tempPathOf(write.path), write.text)
    } catch (error) {
      removeTempFiles([...writes.slice(0, index), write])
      throw notWritten(write.path, error)
    }
  })
}

/** A failure puts back each file replaced before it, and removes the temporary files not yet renamed. */
function replaceEachFileByItsTempFile(writes: readonly FileWrite[]): void {
  const originals = writes.map(originalOf)
  writes.forEach((write, index) => {
    try {
      renameSync(tempPathOf(write.path), write.path)
    } catch (error) {
      originals.slice(0, index).forEach(putBack)
      removeTempFiles(writes.slice(index))
      throw notWritten(write.path, error)
    }
  })
}

function originalOf({ path }: FileWrite): Original {
  return { path, text: existsSync(path) ? readFileSync(path, 'utf8') : null }
}

function putBack({ path, text }: Original): void {
  if (text === null) rmSync(path, { force: true })
  else writeFileSync(path, text)
}

function removeTempFiles(writes: readonly FileWrite[]): void {
  writes.forEach(({ path }) => rmSync(tempPathOf(path), { force: true }))
}

function tempPathOf(path: string): string {
  return `${path}${TEMP_SUFFIX}`
}

function notWritten(path: string, cause: unknown): Error {
  return new Error(`could not write ${path}: ${messageOf(cause)}`, { cause })
}
