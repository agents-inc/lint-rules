import { foundOr } from '@workspace/rule-data/collections'
import type { ESLint, Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import type { ChangedLines } from './changed-lines.ts'
import type { EslintEngine } from './eslint-run.ts'
import { keepsUnchangedLines } from './fix-guard.ts'
import { fixInPlace, type InPlaceFixer, type Snapshots, textOfFileAt, writeIfStillUnchanged } from './fix-writes.ts'
import { eslintFailedOn, goneWhileCheckRan, type NotChecked, oxlintRulesFailed } from './not-checked.ts'
import { runOxlint, type TempOxlintConfig } from './oxlint-run.ts'

/** `readByEslint`: false for a component file, which oxlint's rules alone lint. */
export type CheckedFile = { readonly path: string; readonly changed: ChangedLines; readonly readByEslint: boolean }

/** ESLint's messages on each file it linted. */
export type FixStepResult = {
  readonly eslintMessages: ReadonlyMap<string, readonly Linter.LintMessage[]>
  readonly textChangedIn: readonly string[]
  readonly notChecked: readonly NotChecked[]
}

type OxlintFixRun = { readonly config: TempOxlintConfig; readonly fixRunConfig: OxlintConfig }

type OxlintFixed = { readonly file: CheckedFile; readonly original: string; readonly fixed: string | null }

type ChangedByOxlint = OxlintFixed & { readonly fixed: string }

type FilesAfterOxlint = { readonly files: readonly CheckedFile[]; readonly notChecked: readonly NotChecked[] }

type EslintFixes = Pick<FixStepResult, 'eslintMessages' | 'notChecked'>

/** What ESLint said of a file, or why it said nothing. */
type EslintOnAFile = { readonly messages: readonly Linter.LintMessage[] } | { readonly notChecked: NotChecked }

type EslintCall = { readonly result: ESLint.LintResult } | { readonly notChecked: NotChecked }

/** Each file a kept fix rewrote: check names them however the run ends. */
export type RewrittenFiles = { readonly record: (path: string) => void }

type FixStepRun = { readonly signal: AbortSignal; readonly rewritten: RewrittenFiles }

export type FixStepEngines = {
  readonly oxlint: InPlaceFixer
  readonly eslint: EslintEngine
  readonly changedLinesNow: (path: string) => ChangedLines
}

/**
 * oxlint's fixes, then ESLint's. An engine's fixes in a file are dropped whole where they would
 * change a line nobody changed. A kept fix is never undone, however the run ends. What an engine
 * could not run is listed and the step goes on; only the signal, or git's failure, stops it.
 */
export async function applyFixes(files: readonly CheckedFile[], beforeFixes: Snapshots, engines: FixStepEngines, run: FixStepRun): Promise<FixStepResult> {
  const afterOxlint = await oxlintFixes(files, beforeFixes, engines, run)
  const eslint = await eslintFixesFileByFile(afterOxlint.files.filter(({ readByEslint }) => readByEslint), engines.eslint, run)
  return {
    eslintMessages: eslint.eslintMessages,
    textChangedIn: pathsChangedSince(beforeFixes, files),
    notChecked: [...afterOxlint.notChecked, ...eslint.notChecked],
  }
}

/**
 * oxlint fixes in place, so a file failing the guard is written back. Every file is guarded and
 * recorded before anything can stop the step: the signal is passed on, and git read, only then.
 */
async function oxlintFixes(files: readonly CheckedFile[], before: Snapshots, { oxlint, changedLinesNow }: FixStepEngines, { signal, rewritten }: FixStepRun): Promise<FilesAfterOxlint> {
  const run = await fixInPlace(files.map(({ path }) => path), oxlint, signal)
  const changedByOxlint = files.map((file) => asOxlintLeftIt(file, before)).filter(isChangedByOxlint)
  changedByOxlint.filter((changed) => !passesTheGuard(changed)).forEach(writeBackTheOriginal)
  const kept = new Set(changedByOxlint.filter(passesTheGuard).map(({ file }) => file.path))
  kept.forEach((path) => rewritten.record(path))
  if (run.outcome === 'stopped' && signal.aborted) throw run.reason
  return {
    files: withChangedLinesReadAgain(files, kept, changedLinesNow),
    notChecked: run.outcome === 'stopped' ? [oxlintRulesFailed(run.reason)] : [],
  }
}

/** A kept fix moves the file's lines, so git reads its changed lines again. */
function withChangedLinesReadAgain(files: readonly CheckedFile[], fixesKeptIn: ReadonlySet<string>, changedLinesNow: (path: string) => ChangedLines): CheckedFile[] {
  return files.map((file) => (fixesKeptIn.has(file.path) ? { ...file, changed: changedLinesNow(file.path) } : file))
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
async function eslintFixesFileByFile(files: readonly CheckedFile[], eslint: EslintEngine, { signal, rewritten }: FixStepRun): Promise<EslintFixes> {
  const eslintMessages = new Map<string, readonly Linter.LintMessage[]>()
  const notChecked: NotChecked[] = []
  for (const file of files) {
    signal.throwIfAborted()
    const said = await eslintFixes(file, eslint, rewritten)
    if ('messages' in said) eslintMessages.set(file.path, said.messages)
    else notChecked.push(said.notChecked)
  }
  return { eslintMessages, notChecked }
}

/** Writes the fixes only where they pass the guard and the file still holds the text ESLint read. */
async function eslintFixes({ path, changed }: CheckedFile, eslint: EslintEngine, rewritten: RewrittenFiles): Promise<EslintOnAFile> {
  const read = textOfFileAt(path)
  if (read === null) return { notChecked: goneWhileCheckRan(path) }
  const fixed = await eslintCalledOn(path, () => eslint.fixed(path, read, changed))
  if ('notChecked' in fixed) return fixed
  const { output, messages } = fixed.result
  if (output === undefined) return { messages }
  if (keepsUnchangedLines(read, output, changed) && writeIfStillUnchanged(path, read, output)) {
    rewritten.record(path)
    return { messages }
  }
  return eslintLintedAsItIsNow(path, eslint)
}

async function eslintLintedAsItIsNow(path: string, eslint: EslintEngine): Promise<EslintOnAFile> {
  const now = textOfFileAt(path)
  if (now === null) return { notChecked: goneWhileCheckRan(path) }
  const linted = await eslintCalledOn(path, () => eslint.linted(path, now))
  return 'notChecked' in linted ? linted : { messages: linted.result.messages }
}

/** A rule's crash, or anything else ESLint throws on the file, leaves it unchecked by ESLint alone. */
async function eslintCalledOn(path: string, call: () => Promise<ESLint.LintResult>): Promise<EslintCall> {
  try {
    return { result: await call() }
  } catch (error) {
    return { notChecked: eslintFailedOn(path, error) }
  }
}

/** A file another writer left no file at counts too. */
function pathsChangedSince(before: Snapshots, files: readonly CheckedFile[]): string[] {
  return files.filter(({ path }) => textOfFileAt(path) !== textOf(before, path)).map(({ path }) => path)
}

function textOf(snapshots: Snapshots, path: string): string {
  return foundOr(snapshots.get(path), `no text of ${path} was kept before the fixes`)
}
