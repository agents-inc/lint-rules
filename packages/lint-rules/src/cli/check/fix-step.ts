import { readFileSync } from 'node:fs'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import type { ChangedLines } from './changed-lines.ts'
import type { EslintEngine } from './eslint-run.ts'
import { keepsUnchangedLines } from './fix-guard.ts'
import { fixInPlace, type InPlaceFixer, type Snapshots, textOfFileAt, writeIfStillUnchanged } from './fix-writes.ts'
import { runOxlint, type TempOxlintConfig } from './oxlint-run.ts'

/** A file check lints, by its absolute path, with the lines of it that changed. */
export type CheckedFile = { readonly path: string; readonly changed: ChangedLines }

/**
 * What the fix step leaves: each file's ESLint messages on its text as it now is, and the files
 * whose text differs from their text before the fixes, whoever changed it.
 */
export type FixStepResult = {
  readonly eslintMessages: ReadonlyMap<string, readonly Linter.LintMessage[]>
  readonly textChangedIn: readonly string[]
}

/** oxlint's fix run: the temporary config it reads, and the agent build it is written with. */
export type OxlintFixRun = { readonly config: TempOxlintConfig; readonly fixRunConfig: OxlintConfig }

/** A file as oxlint's fix run left it: its text before the run, and its text after, null where it is no longer there. */
type OxlintFixed = { readonly file: CheckedFile; readonly original: string; readonly fixed: string | null }

/** One that oxlint's fixes changed. */
type ChangedByOxlint = OxlintFixed & { readonly fixed: string }

/**
 * Where the fix step records each file, by its absolute path, that a fix of its own rewrote and
 * kept: check names them in its autofixed line, however the run ends (P2).
 */
export type RewrittenFiles = { readonly record: (path: string) => void }

/** The run the fix step is part of: the signal that stops it, and where it records the files it rewrites. */
export type FixStepRun = { readonly signal: AbortSignal; readonly rewritten: RewrittenFiles }

export type FixStepEngines = {
  /** oxlint's fix run, which writes into the files: oxlintFixer's. */
  readonly oxlint: InPlaceFixer
  readonly eslint: EslintEngine
  /** The lines of the file that changed, read again from git after a fix changed its text. */
  readonly changedLinesNow: (path: string) => ChangedLines
}

/**
 * Applies the fixes on the changed lines, oxlint's then ESLint's (q-c11): each engine's fixes in a
 * file are dropped whole where they would delete or modify a line nobody changed (P1). ESLint lints
 * every file on the way, so its messages describe the text as it is left. `beforeFixes` holds each
 * file's text as the fixes find it. A fix that stays is never undone, however the run ends
 * (decided 2026-10-15): each is recorded in the run's `rewritten` as it is kept.
 */
export async function applyFixes(files: readonly CheckedFile[], beforeFixes: Snapshots, engines: FixStepEngines, run: FixStepRun): Promise<FixStepResult> {
  const afterOxlint = await oxlintFixes(files, beforeFixes, engines, run)
  const eslintMessages = await eslintFixesFileByFile(afterOxlint, engines.eslint, run)
  return { eslintMessages, textChangedIn: pathsChangedSince(beforeFixes, files) }
}

/**
 * oxlint fixes in place, so a file whose fixes fail the guard is written back as it was. Every file
 * it changed is guarded, and each it keeps recorded, before anything can stop the step: the signal
 * or failure that stopped oxlint's own run is passed on only then, and git, which can fail, is read
 * only then. The files, with their lines read again where a fix stayed.
 */
async function oxlintFixes(
  files: readonly CheckedFile[],
  before: Snapshots,
  { oxlint, changedLinesNow }: FixStepEngines,
  { signal, rewritten }: FixStepRun,
): Promise<CheckedFile[]> {
  const run = await fixInPlace(files.map(({ path }) => path), oxlint, signal)
  const changedByOxlint = files.map((file) => asOxlintLeftIt(file, before)).filter(isChangedByOxlint)
  changedByOxlint.filter((changed) => !passesTheGuard(changed)).forEach(writeBackTheOriginal)
  const kept = new Set(changedByOxlint.filter(passesTheGuard).map(({ file }) => file.path))
  kept.forEach((path) => rewritten.record(path))
  if (run.outcome === 'stopped') throw run.reason
  return files.map((file) => (kept.has(file.path) ? { path: file.path, changed: changedLinesNow(file.path) } : file))
}

export function oxlintFixer({ config, fixRunConfig }: OxlintFixRun): InPlaceFixer {
  return async (paths, signal) => {
    await runOxlint(config, fixRunConfig, paths, { fix: true, signal })
  }
}

function asOxlintLeftIt(file: CheckedFile, before: Snapshots): OxlintFixed {
  return { file, original: textOf(before, file.path), fixed: textOfFileAt(file.path) }
}

function isChangedByOxlint(oxlintFixed: OxlintFixed): oxlintFixed is ChangedByOxlint {
  return oxlintFixed.fixed !== null && oxlintFixed.fixed !== oxlintFixed.original
}

function passesTheGuard({ file, original, fixed }: ChangedByOxlint): boolean {
  return keepsUnchangedLines(original, fixed, file.changed)
}

/**
 * Writes the file back as it was before oxlint's fixes, while it still holds their text (F-6). No
 * test reaches this guard: the text oxlint left is read and written back in one synchronous pass,
 * with no await between, so only another process can write in between.
 */
function writeBackTheOriginal({ file, original, fixed }: ChangedByOxlint): void {
  writeIfStillUnchanged(file.path, fixed, original)
}

/** Each file's ESLint messages, by its path. One file at a time: the ESLint engine's fix predicate holds the lines of the file it is fixing. */
async function eslintFixesFileByFile(
  files: readonly CheckedFile[],
  eslint: EslintEngine,
  { signal, rewritten }: FixStepRun,
): Promise<ReadonlyMap<string, readonly Linter.LintMessage[]>> {
  const messages = new Map<string, readonly Linter.LintMessage[]>()
  for (const file of files) {
    signal.throwIfAborted()
    messages.set(file.path, await eslintFixes(file, eslint, rewritten))
  }
  return messages
}

/**
 * ESLint's fixes are written only where they pass the guard and the file still holds the text ESLint
 * read (F-6); otherwise the file is linted as it is. Its messages on the text it leaves.
 */
async function eslintFixes({ path, changed }: CheckedFile, eslint: EslintEngine, rewritten: RewrittenFiles): Promise<readonly Linter.LintMessage[]> {
  const read = readFileSync(path, 'utf8')
  const { output, messages } = await eslint.fixed(path, read, changed)
  if (output === undefined) return messages
  if (keepsUnchangedLines(read, output, changed) && writeIfStillUnchanged(path, read, output)) {
    rewritten.record(path)
    return messages
  }
  return (await eslint.linted(path, readFileSync(path, 'utf8'))).messages
}

/** The files whose text differs from the snapshot taken before the fixes. */
function pathsChangedSince(before: Snapshots, files: readonly CheckedFile[]): string[] {
  return files.filter(({ path }) => readFileSync(path, 'utf8') !== textOf(before, path)).map(({ path }) => path)
}

function textOf(snapshots: Snapshots, path: string): string {
  const text = snapshots.get(path)
  if (text === undefined) throw new Error(`no text of ${path} was kept before the fixes`)
  return text
}
