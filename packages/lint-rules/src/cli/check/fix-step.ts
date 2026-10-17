import { readFileSync } from 'node:fs'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import type { ChangedLines } from './changed-lines.ts'
import type { EslintEngine } from './eslint-run.ts'
import { keepsUnchangedLines } from './fix-guard.ts'
import { fixInPlace, type InPlaceFixer, type Snapshots, textOfFileAt, writeIfStillUnchanged } from './fix-writes.ts'
import { runOxlint, type TempOxlintConfig } from './oxlint-run.ts'

export type CheckedFile = { readonly path: string; readonly changed: ChangedLines }

export type FixStepResult = {
  readonly eslintMessages: ReadonlyMap<string, readonly Linter.LintMessage[]>
  readonly textChangedIn: readonly string[]
}

export type OxlintFixRun = { readonly config: TempOxlintConfig; readonly fixRunConfig: OxlintConfig }

type OxlintFixed = { readonly file: CheckedFile; readonly original: string; readonly fixed: string | null }

type ChangedByOxlint = OxlintFixed & { readonly fixed: string }

/** Each file a kept fix rewrote: check names them however the run ends. */
export type RewrittenFiles = { readonly record: (path: string) => void }

export type FixStepRun = { readonly signal: AbortSignal; readonly rewritten: RewrittenFiles }

export type FixStepEngines = {
  readonly oxlint: InPlaceFixer
  readonly eslint: EslintEngine
  readonly changedLinesNow: (path: string) => ChangedLines
}

/**
 * oxlint's fixes, then ESLint's. An engine's fixes in a file are dropped whole where they would
 * change a line nobody changed. A kept fix is never undone, however the run ends.
 */
export async function applyFixes(files: readonly CheckedFile[], beforeFixes: Snapshots, engines: FixStepEngines, run: FixStepRun): Promise<FixStepResult> {
  const afterOxlint = await oxlintFixes(files, beforeFixes, engines, run)
  const eslintMessages = await eslintFixesFileByFile(afterOxlint, engines.eslint, run)
  return { eslintMessages, textChangedIn: pathsChangedSince(beforeFixes, files) }
}

/**
 * oxlint fixes in place, so a file failing the guard is written back. Every file is guarded and
 * recorded before anything can stop the step: the stop is passed on, and git read, only then.
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

/** No test reaches this guard: the read and write-back are one synchronous pass, so only another process can interleave. */
function writeBackTheOriginal({ file, original, fixed }: ChangedByOxlint): void {
  writeIfStillUnchanged(file.path, fixed, original)
}

/** One file at a time: the ESLint engine's fix predicate holds the lines of the file it is fixing. */
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

/** Writes the fixes only where they pass the guard and the file still holds the text ESLint read. */
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

function pathsChangedSince(before: Snapshots, files: readonly CheckedFile[]): string[] {
  return files.filter(({ path }) => readFileSync(path, 'utf8') !== textOf(before, path)).map(({ path }) => path)
}

function textOf(snapshots: Snapshots, path: string): string {
  const text = snapshots.get(path)
  if (text === undefined) throw new Error(`no text of ${path} was kept before the fixes`)
  return text
}
