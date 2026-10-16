import { readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { catalog } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import { type AgentConfigs, buildAgentConfigs } from '../../agent-configs.ts'
import { agentSettingsOf } from '../../agent-settings.ts'
import type { EslintPart } from '../../core/editor-parts.ts'
import { liesOutside } from '../../core/lies-outside.ts'
import { EXIT_CLEAN } from '../exit-codes.ts'
import type { Outcome, StdoutIfStopped } from '../outcome.ts'
import { textOfLines } from '../printed-lines.ts'
import type { ChangedLines } from './changed-lines.ts'
import { eslintPartExportedBy, type FoundConfig, nearestConfig, refuseAnotherCopy } from './config-lookup.ts'
import { type EslintEngine, eslintEngineFor } from './eslint-run.ts'
import { type FileReports, findingsIn } from './findings.ts'
import { applyFixes, type CheckedFile, type FixStepResult, oxlintFixer, type RewrittenFiles } from './fix-step.ts'
import { type Snapshots, snapshotsOf } from './fix-writes.ts'
import { type ChangedFile, changedFilesIn, changedLinesOf, type GitRepo, gitRepoAt, gitTopLevelOf } from './git-changes.ts'
import { removeLeftovers } from './leftovers.ts'
import type { OxlintDiagnostic, OxlintReport } from './oxlint-output.ts'
import { fixRunConfigOf, lintRunConfigOf, runOxlint, tempOxlintConfigIn } from './oxlint-run.ts'
import { autofixedStdout, type CheckReport, checkReport } from './report.ts'
import { NOTHING_TO_CHECK, notInGit, skippedNote } from './texts.ts'
import { WITHHELD_FIXES } from './withheld-fixes.ts'

/** A changed file: its absolute path, and the path check prints, from the config's folder with forward slashes (`..` first outside it). */
type FileInFolder = { readonly change: ChangedFile; readonly path: string; readonly file: string }

/** A file the engines lint, with the lines of it that changed. */
type ScopedFile = FileInFolder & CheckedFile

/** One run's files, and what it lints them with. */
type CheckRun = {
  readonly repo: GitRepo
  readonly folder: string
  readonly configs: AgentConfigs
  readonly eslint: EslintEngine
  readonly files: readonly ScopedFile[]
  readonly signal: AbortSignal
}

/** What the fix step and the last oxlint run leave. */
type LintResults = { readonly fixes: FixStepResult; readonly oxlintReport: OxlintReport }

/** The files check's fixes rewrote, recorded as each fix is kept, and named as check prints them, in the run's order. */
type AutofixedFiles = RewrittenFiles & { readonly named: () => string[] }

const JS_AND_TS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx'])
const GLOB_SEPARATOR = '/'

/**
 * `agents-inc-lint check` (spec-cli.md "K: check"): fixes, then lints, the JS and TS lines changed
 * since the last commit under the nearest agents-inc.lint.mts, with its agent build, and reports
 * what is left. Throws where it could not run, with `ifStopped` naming the files it fixed by then;
 * leaves no file of its own behind.
 */
export async function checkIn(cwd: string, signal: AbortSignal, ifStopped: StdoutIfStopped): Promise<Outcome> {
  const gitTopLevel = gitTopLevelOf(cwd)
  if (gitTopLevel === null) throw new Error(notInGit(cwd))
  const config = nearestConfig(cwd, gitTopLevel)
  refuseAnotherCopy(config)
  const eslintPart = await eslintPartExportedBy(config)
  try {
    return await checkChanges(gitRepoAt(gitTopLevel), config, eslintPart, { signal, ifStopped })
  } finally {
    removeLeftovers()
  }
}

async function checkChanges(
  repo: GitRepo,
  config: FoundConfig,
  eslintPart: EslintPart,
  { signal, ifStopped }: { readonly signal: AbortSignal; readonly ifStopped: StdoutIfStopped },
): Promise<Outcome> {
  const jsAndTs = changedFilesIn(repo)
    .filter(isJsOrTs)
    .map((change) => fileInFolder(repo, config, change))
  const inFolder = jsAndTs.filter((file) => isInsideTheConfigFolder(config, file))
  const stderr = skippedNoteText(jsAndTs.length - inFolder.length, config.folder)
  if (inFolder.length === 0) return nothingToCheck(stderr)

  const configs = buildAgentConfigs(agentSettingsOf(eslintPart))
  const eslint = eslintEngineFor(config.folder, configs.eslint, WITHHELD_FIXES)
  const files = withChangedLines(repo, await filesLintedOf(inFolder, eslint.isIgnored))
  if (files.length === 0) return nothingToCheck(stderr)

  const run: CheckRun = { repo, folder: config.folder, configs, eslint, files, signal }
  const { stdout, exitCode } = await fixedThenReported(run, snapshotsOf(pathsOf(files)), autofixedFilesOf(files, ifStopped))
  return { stdout, stderr, exitCode }
}

/** Applies the fixes (step 11), lints what they leave (step 13) and reports what of it is the change's (steps 14 to 16). */
async function fixedThenReported(run: CheckRun, beforeFixes: Snapshots, autofixed: AutofixedFiles): Promise<CheckReport> {
  const { folder, configs, eslint, files, signal } = run
  const oxlintConfig = tempOxlintConfigIn(folder)
  const fixRunConfig = fixRunConfigOf(configs.oxlint, WITHHELD_FIXES, catalog)
  const changedLinesNow = (path: string): ChangedLines => changedLinesReadAgain(run, path)
  const fixes = await applyFixes(files, beforeFixes, { oxlint: oxlintFixer({ config: oxlintConfig, fixRunConfig }), eslint, changedLinesNow }, { signal, rewritten: autofixed })
  const oxlintReport = await runOxlint(oxlintConfig, lintRunConfigOf(configs.oxlint), pathsOf(files), { fix: false, signal })
  const reports = await Promise.all(files.map((file) => reportsOn(file, { fixes, oxlintReport }, run)))
  return checkReport({
    findings: reports.flatMap((fileReports) => findingsIn(fileReports, catalog)),
    changedFileCount: files.length,
    autofixedFiles: autofixed.named(),
  })
}

/** Both engines' reports on the file as the fixes left it, with its changed lines read again where its text changed (step 12). */
async function reportsOn({ path, file, changed }: ScopedFile, { fixes, oxlintReport }: LintResults, run: CheckRun): Promise<FileReports> {
  return {
    file,
    text: readFileSync(path, 'utf8'),
    changed: fixes.textChangedIn.includes(path) ? changedLinesReadAgain(run, path) : changed,
    suppressionsAllowed: await run.eslint.allowsSuppressionsIn(path),
    eslintMessages: eslintMessagesOn(fixes, path),
    oxlintDiagnostics: oxlintDiagnosticsOn(oxlintReport, run.folder, path),
  }
}

/** The lines of the file that changed, read again from git once a fix changed its text. */
function changedLinesReadAgain({ repo, files }: CheckRun, path: string): ChangedLines {
  return changedLinesOf(repo, scopedFileAt(files, path).change)
}

function nothingToCheck(stderr: string): Outcome {
  return { stdout: textOfLines([NOTHING_TO_CHECK]), stderr, exitCode: EXIT_CLEAN }
}

/** stderr's one note, on the changed files outside the config's folder: nothing where there are none. */
function skippedNoteText(skippedCount: number, configFolder: string): string {
  if (skippedCount === 0) return ''
  return textOfLines([skippedNote(skippedCount, configFolder)])
}

function isJsOrTs({ path }: ChangedFile): boolean {
  return JS_AND_TS_EXTENSIONS.has(extname(path))
}

function isInsideTheConfigFolder({ folder }: FoundConfig, { path }: FileInFolder): boolean {
  return !liesOutside(relative(folder, path))
}

function fileInFolder(repo: GitRepo, config: FoundConfig, change: ChangedFile): FileInFolder {
  const path = join(repo.topLevel, change.path)
  return { change, path, file: relative(config.folder, path).split(sep).join(GLOB_SEPARATOR) }
}

/** The files the engines lint: those on disk that the agent build's ignores leave in. Both engines get this one list. */
async function filesLintedOf(files: readonly FileInFolder[], isIgnored: (path: string) => Promise<boolean>): Promise<FileInFolder[]> {
  const onDisk = files.filter(({ path }) => statSync(path, { throwIfNoEntry: false })?.isFile() === true)
  const ignored = await Promise.all(onDisk.map(({ path }) => isIgnored(path)))
  return onDisk.filter((_file, index) => ignored[index] === false)
}

function pathsOf(files: readonly ScopedFile[]): string[] {
  return files.map(({ path }) => path)
}

function withChangedLines(repo: GitRepo, files: readonly FileInFolder[]): ScopedFile[] {
  return files.map((file) => ({ ...file, changed: changedLinesOf(repo, file.change) }))
}

/**
 * Where the fix step records the files its fixes rewrote. Each record brings `ifStopped` up to date:
 * a run a signal or a failure stops still names, in its autofixed line, every file it rewrote (P2).
 */
function autofixedFilesOf(files: readonly ScopedFile[], ifStopped: StdoutIfStopped): AutofixedFiles {
  const rewritten = new Set<string>()
  const named = (): string[] => files.filter(({ path }) => rewritten.has(path)).map(({ file }) => file)
  return {
    record: (path) => {
      rewritten.add(path)
      ifStopped.update(autofixedStdout(named()))
    },
    named,
  }
}

function scopedFileAt(files: readonly ScopedFile[], path: string): ScopedFile {
  const found = files.find((file) => file.path === path)
  if (found === undefined) throw new Error(`${path} is not among the files check lints`)
  return found
}

function eslintMessagesOn({ eslintMessages }: FixStepResult, path: string): readonly Linter.LintMessage[] {
  const messages = eslintMessages.get(path)
  if (messages === undefined) throw new Error(`ESLint gave no result for ${path}`)
  return messages
}

/** oxlint names each file from the folder it ran in. */
function oxlintDiagnosticsOn({ diagnostics }: OxlintReport, folder: string, path: string): readonly OxlintDiagnostic[] {
  return diagnostics.filter(({ filename }) => resolve(folder, filename) === path)
}
